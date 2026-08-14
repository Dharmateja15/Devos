import { Injectable, Logger } from '@nestjs/common';

export interface AIGenerationOptions {
  provider?: 'groq' | 'gemini' | 'huggingface';
  prompt: string;
  cacheKey: string;
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  
  // MVP temporary/in-memory cache boundary.
  // The permanent storage technology remains UNRESOLVED (No QuestionBank).
  private readonly contentCache = new Map<string, any>();

  /**
   * Retrieves content from the temporary in-memory cache.
   */
  getCachedContent<T>(cacheKey: string): T | null {
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey) as T;
    }
    return null;
  }

  /**
   * Stores generated content into the temporary cache for reuse.
   */
  storeGeneratedContent(cacheKey: string, content: any): void {
    this.contentCache.set(cacheKey, content);
  }

  /**
   * Generates educational content, leveraging caching to avoid unnecessary API calls.
   * PHASE 3B-10: Cached AI-content reuse.
   */
  async generateContent<T>(options: AIGenerationOptions): Promise<T | null> {
    const { cacheKey, prompt, provider = 'gemini' } = options;

    // 1. Check whether suitable stored content exists
    const cached = this.getCachedContent<T>(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cached;
    }

    // 2. Only call the AI provider when generation is actually necessary
    try {
      this.logger.log(`Generating content via provider: ${provider}`);
      
      const content = await this.callProvider(provider, prompt);
      
      // 3. Store and Reuse
      this.storeGeneratedContent(cacheKey, content);
      
      return content as T;
    } catch (error) {
      // PHASE 3B-11: AI Failure handling
      // Do not fabricate educational content. Do not pretend generation succeeded.
      this.logger.error(`AI Provider ${provider} failed: ${error.message}`);
      // Returning explicit unavailable state (null)
      return null;
    }
  }

  /**
   * Abstract provider call (PHASE 3B-9: AI Gateway abstraction)
   */
  private async callProvider(provider: string, prompt: string): Promise<any> {
    // In a real implementation, this would switch between different API clients.
    // We are not hard-coding the system around any single provider.
    // For production, if there's no actual API key configured, we must throw an error, 
    // NOT mock it. Since we do not have an API key, we throw an error directly.
    throw new Error('AI Provider not configured. Failing safely without fabricating content.');
  }
}
