import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { AuthProvider } from '@prisma/client';
import { randomBytes } from 'crypto';
import { encryptToken } from '../common/crypto.util';

@Injectable()
export class GitHubOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generates a cryptographically random, 10-minute (600s) expiring OAuth state token bound to userId
   * and persists it in Redis (`oauth:github:state:<state>`).
   */
  async createState(userId: string): Promise<string> {
    const state = randomBytes(32).toString('hex');
    try {
      await this.redisService.setOAuthState(state, userId, 600);
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to persist OAuth state in session cache: ${err.message}`,
      );
    }
    return state;
  }

  /**
   * Atomically fetches and deletes an OAuth state token from Redis.
   * Guarantees single-use state consumption and prevents replay races across API instances.
   */
  async consumeState(state: string): Promise<string | null> {
    if (!state || typeof state !== 'string') return null;
    try {
      const data = await this.redisService.getAndDeleteOAuthState(state);
      return data?.userId || null;
    } catch (err: any) {
      return null;
    }
  }

  /**
   * Constructs GitHub OAuth authorization URL with configured client ID, callback URL, and scope.
   */
  async getAuthorizationUrl(userId: string): Promise<string> {
    const clientId = process.env.GITHUB_CLIENT_ID || 'mock_github_client_id';
    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/oauth/github/callback';
    const state = await this.createState(userId);

    return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user&state=${encodeURIComponent(state)}`;
  }

  /**
   * Processes GitHub OAuth callback: exchanges code for access token, fetches profile,
   * checks ownership, and upserts OAuthAccount for the authenticated DevOS user.
   */
  async handleCallback(code: string, state: string) {
    const userId = await this.consumeState(state);
    if (!userId) {
      throw new UnauthorizedException(
        'Invalid, expired, or reused OAuth state token',
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID || 'mock_github_client_id';
    const clientSecret =
      process.env.GITHUB_CLIENT_SECRET || 'mock_github_client_secret';
    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/oauth/github/callback';

    // 1. Exchange authorization code for GitHub OAuth access token
    let accessToken: string;
    try {
      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: callbackUrl,
          }),
        },
      );

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error_description ||
            'Failed to exchange GitHub authorization code',
        );
      }
      accessToken = tokenData.access_token;
    } catch (err: any) {
      throw new UnauthorizedException(
        `GitHub token exchange failed: ${err.message}`,
      );
    }

    // 2. Retrieve authenticated GitHub user identity
    let providerId: string;
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'DevOS-Platform',
        },
      });

      const userData = await userRes.json();
      if (!userRes.ok || !userData.id) {
        throw new Error('Failed to retrieve GitHub user profile');
      }
      providerId = String(userData.id);
    } catch (err: any) {
      throw new UnauthorizedException(
        `GitHub profile retrieval failed: ${err.message}`,
      );
    }

    // 3. Prevent account takeover (ownership check)
    const existingAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        provider: AuthProvider.GITHUB,
        providerId,
      },
    });

    if (existingAccount && existingAccount.userId !== userId) {
      throw new ConflictException(
        'This GitHub account is already connected to another DevOS user account.',
      );
    }

    // 4. Encrypt OAuth access token before database persistence
    const encryptedAccessToken = encryptToken(accessToken);

    await this.prisma.oAuthAccount.upsert({
      where: {
        provider_providerId: {
          provider: AuthProvider.GITHUB,
          providerId,
        },
      },
      update: {
        userId,
        accessToken: encryptedAccessToken,
        scopes: ['read:user'],
      },
      create: {
        userId,
        provider: AuthProvider.GITHUB,
        providerId,
        accessToken: encryptedAccessToken,
        scopes: ['read:user'],
      },
    });

    return { userId, success: true };
  }
}
