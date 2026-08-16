import { Test, TestingModule } from '@nestjs/testing';
import { AiGatewayService } from './ai-gateway.service';

describe('AiGatewayService', () => {
  let service: AiGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiGatewayService],
    }).compile();

    service = module.get<AiGatewayService>(AiGatewayService);
  });

  // 20. AI unavailable does not fabricate content
  it('Fails safely and returns null if AI provider is not configured or fails (no fabrication)', async () => {
    // In our implementation, if provider is missing, it throws an error in callProvider, caught by generateContent.
    const result = await service.generateContent({
      cacheKey: 'test',
      prompt: 'test',
    });
    expect(result).toBeNull();
  });

  // 21. Cached content is reused
  it('Reuses cached content without calling provider', async () => {
    service.storeGeneratedContent('key1', { generatedText: 'cached' });
    const result = await service.generateContent({
      cacheKey: 'key1',
      prompt: 'test',
    });
    expect(result).toEqual({ generatedText: 'cached' });
  });
});
