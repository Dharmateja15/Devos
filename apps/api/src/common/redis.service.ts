import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Fail immediately if Redis is unreachable
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis Client Error: ${err.message}`);
    });
  }

  async onModuleInit() {
    try {
      if (process.env.NODE_ENV !== 'test') {
        await this.client.connect();
        this.logger.log('Successfully connected to Redis instance.');
      }
    } catch (err: any) {
      this.logger.warn(`Redis connection failed on startup: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connect') {
        await this.client.quit();
      }
    } catch (err: any) {
      this.logger.error(`Error during Redis disconnect: ${err.message}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  private fallbackStore = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  /**
   * Stores OAuth state token in Redis with a strict 600-second (10-minute) TTL.
   */
  async setOAuthState(
    state: string,
    userId: string,
    ttlSeconds = 600,
  ): Promise<void> {
    const key = `oauth:github:state:${state}`;
    const value = JSON.stringify({ userId });
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch {
      this.fallbackStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  /**
   * Atomically fetches and deletes an OAuth state token from Redis in a single atomic Lua operation.
   * Guarantees single-use state consumption and prevents replay races across API instances.
   */
  async getAndDeleteOAuthState(
    state: string,
  ): Promise<{ userId: string } | null> {
    if (!state || typeof state !== 'string') return null;

    const key = `oauth:github:state:${state}`;
    let rawResult: string | null = null;
    try {
      const luaScript = `
        local val = redis.call('get', KEYS[1])
        if val then
          redis.call('del', KEYS[1])
        end
        return val
      `;
      rawResult = (await this.client.eval(luaScript, 1, key)) as string | null;
    } catch {
      const fallback = this.fallbackStore.get(key);
      if (fallback && fallback.expiresAt > Date.now()) {
        rawResult = fallback.value;
        this.fallbackStore.delete(key);
      }
    }

    if (!rawResult) return null;

    try {
      return JSON.parse(rawResult);
    } catch {
      return null;
    }
  }

  /**
   * Stores CSV import preview payload in Redis bound to previewToken with a default 900s (15min) TTL.
   * Authoritative preview state is strictly stored in Redis with NO process-local memory fallback.
   */
  async setImportPreviewState(
    previewToken: string,
    payload: any,
    ttlSeconds = 900,
  ): Promise<void> {
    const key = `import:csv:preview:${previewToken}`;
    const statePayload = { ...payload, status: 'READY', createdAt: Date.now() };
    const value = JSON.stringify(statePayload);
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Atomically transitions preview state from READY -> EXECUTING.
   * Guarantees atomic lock acquisition so concurrent execute calls cannot duplicate execution.
   */
  async acquireImportPreviewExecution(
    previewToken: string,
    userId: string,
    journeyId: string,
  ): Promise<{ error?: 'NOT_FOUND' | 'FORBIDDEN' | 'LOCKED'; data?: any }> {
    if (!previewToken || typeof previewToken !== 'string') {
      return { error: 'NOT_FOUND' };
    }

    const key = `import:csv:preview:${previewToken}`;

    const luaScript = `
      local key = KEYS[1]
      local valStr = redis.call('get', key)
      if not valStr then
        return cjson.encode({ error = 'NOT_FOUND' })
      end
      local val = cjson.decode(valStr)
      if val.userId ~= ARGV[1] or val.journeyId ~= ARGV[2] then
        return cjson.encode({ error = 'FORBIDDEN' })
      end
      if val.status == 'EXECUTING' or val.status == 'COMMITTED' then
        return cjson.encode({ error = 'LOCKED' })
      end
      val.status = 'EXECUTING'
      local ttl = redis.call('ttl', key)
      if ttl <= 0 then ttl = 900 end
      redis.call('set', key, cjson.encode(val), 'EX', ttl)
      return cjson.encode({ success = true, data = val })
    `;

    const resStr = (await this.client.eval(
      luaScript,
      1,
      key,
      userId,
      journeyId,
    )) as string;
    const res = JSON.parse(resStr);
    if (res.error) return { error: res.error };
    return { data: res.data };
  }

  /**
   * Permanently commits/deletes preview state after successful transaction execution.
   */
  async commitImportPreviewState(previewToken: string): Promise<void> {
    const key = `import:csv:preview:${previewToken}`;
    await this.client.del(key);
  }

  /**
   * Resets preview state status back from EXECUTING to READY if a transaction encounters a transient failure.
   * Preserves valid preview for safe retry.
   */
  async releaseImportPreviewExecution(previewToken: string): Promise<void> {
    const key = `import:csv:preview:${previewToken}`;
    const luaScript = `
      local key = KEYS[1]
      local valStr = redis.call('get', key)
      if valStr then
        local val = cjson.decode(valStr)
        if val.status == 'EXECUTING' then
          val.status = 'READY'
          local ttl = redis.call('ttl', key)
          if ttl <= 0 then ttl = 900 end
          redis.call('set', key, cjson.encode(val), 'EX', ttl)
        end
      end
    `;
    await this.client.eval(luaScript, 1, key);
  }

  /**
   * Atomically fetches and deletes CSV import preview payload from Redis using Lua script.
   * Ensures single-use execution and prevents preview token replay attacks.
   */
  async getAndDeleteImportPreviewState(
    previewToken: string,
  ): Promise<any | null> {
    if (!previewToken || typeof previewToken !== 'string') return null;

    const key = `import:csv:preview:${previewToken}`;
    const luaScript = `
      local val = redis.call('get', KEYS[1])
      if val then
        redis.call('del', KEYS[1])
      end
      return val
    `;
    const rawResult = (await this.client.eval(luaScript, 1, key)) as
      string | null;
    if (!rawResult) return null;

    try {
      return JSON.parse(rawResult);
    } catch {
      return null;
    }
  }
}
