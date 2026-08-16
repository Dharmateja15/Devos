import { Test, TestingModule } from '@nestjs/testing';
import {
  GitHubEvidenceService,
  GitHubVerificationStatus,
} from './github-evidence.service';
import { GitHubClientAdapter } from './github-client.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceType, AuthProvider, RoadmapNodeType } from '@prisma/client';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('GitHubEvidenceService (Sub-Block 6B)', () => {
  let service: GitHubEvidenceService;
  let adapter: GitHubClientAdapter;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      task: { findUnique: jest.fn() },
      roadmap: { findMany: jest.fn().mockResolvedValue([]) },
      oAuthAccount: { findFirst: jest.fn() },
      evidenceItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubEvidenceService,
        GitHubClientAdapter,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<GitHubEvidenceService>(GitHubEvidenceService);
    adapter = module.get<GitHubClientAdapter>(GitHubClientAdapter);
  });

  describe('SSRF Safety & URL Validation', () => {
    it('1. Accepts valid HTTPS github.com URL', () => {
      const parsed = adapter.parseAndSanitizeGitHubUrl(
        'https://github.com/octocat/Hello-World',
      );
      expect(parsed).toEqual({ owner: 'octocat', repo: 'Hello-World' });
    });

    it('2. Rejects HTTP, alternate hostnames, custom ports, or userinfo', () => {
      expect(() =>
        adapter.parseAndSanitizeGitHubUrl(
          'http://github.com/octocat/Hello-World',
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        adapter.parseAndSanitizeGitHubUrl(
          'https://malicious.com/octocat/Hello-World',
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        adapter.parseAndSanitizeGitHubUrl(
          'https://github.com:8080/octocat/Hello-World',
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        adapter.parseAndSanitizeGitHubUrl(
          'https://user:pass@github.com/octocat/Hello-World',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('Identity Verification Model & Email Match Rule', () => {
    it('1. Marks REPOSITORY_OWNER_VERIFIED when OAuth providerId matches repo owner', async () => {
      prismaService.oAuthAccount.findFirst.mockResolvedValue({
        providerId: 'octocat',
        accessToken: 'token-1',
      });
      prismaService.evidenceItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'ev-1', ...data }),
      );

      jest.spyOn(adapter, 'fetchRepoMetadata').mockResolvedValue({
        owner: 'octocat',
        name: 'repo-1',
        fullName: 'octocat/repo-1',
        defaultBranch: 'main',
        isPrivate: false,
        htmlUrl: 'https://github.com/octocat/repo-1',
        ownerId: 'octocat',
        ownerLogin: 'octocat',
      });

      jest.spyOn(adapter, 'fetchCommitMetadata').mockResolvedValue({
        sha: 'abc1234',
        authorGitHubLogin: 'octocat',
      });

      jest.spyOn(adapter, 'fetchManifestContents').mockResolvedValue([]);

      const res: any = await service.submitGitHubRepository('user-1', {
        repoUrl: 'https://github.com/octocat/repo-1',
      });

      expect(res.verified).toBe(true);
      expect(res.metadata.verificationStatus).toBe(
        GitHubVerificationStatus.REPOSITORY_OWNER_VERIFIED,
      );
    });

    it('2. Email match alone does NOT produce verified = true or COMMIT_AUTHOR_MATCH status', async () => {
      prismaService.oAuthAccount.findFirst.mockResolvedValue({
        providerId: 'user-connected-id',
        accessToken: 'token-1',
      });
      prismaService.evidenceItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'ev-2', ...data }),
      );

      jest.spyOn(adapter, 'fetchRepoMetadata').mockResolvedValue({
        owner: 'some-org',
        name: 'repo-2',
        fullName: 'some-org/repo-2',
        defaultBranch: 'main',
        isPrivate: false,
        htmlUrl: 'https://github.com/some-org/repo-2',
        ownerLogin: 'some-org',
      });

      // Commit author email matches connected user, but login/ID is unverified
      jest.spyOn(adapter, 'fetchCommitMetadata').mockResolvedValue({
        sha: 'def5678',
        authorName: 'Random Developer',
        authorEmail: 'user@domain.com', // Matching email
        authorGitHubLogin: 'unrelated-github-handle',
      });

      jest.spyOn(adapter, 'fetchManifestContents').mockResolvedValue([]);

      const res: any = await service.submitGitHubRepository('user-1', {
        repoUrl: 'https://github.com/some-org/repo-2',
      });

      expect(res.verified).toBe(false);
      expect(res.metadata.verificationStatus).toBe(
        GitHubVerificationStatus.PUBLIC_REPOSITORY_SUBMISSION,
      );
      expect(res.metadata.identityNotes).toContain('Commit email');
    });
  });

  describe('Explicit Project / Task Ownership Authorization', () => {
    it('1. Rejects project attachment if project belongs to another user', async () => {
      prismaService.project.findUnique.mockResolvedValue({
        id: 'p-other',
        journey: { userId: 'other-user', deletedAt: null },
      });

      await expect(
        service.submitGitHubRepository('user-1', {
          repoUrl: 'https://github.com/owner/repo',
          projectId: 'p-other',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2. Rejects task attachment if task belongs to another user', async () => {
      prismaService.task.findUnique.mockResolvedValue({
        id: 't-other',
        journey: { userId: 'other-user', deletedAt: null },
      });

      await expect(
        service.submitGitHubRepository('user-1', {
          repoUrl: 'https://github.com/owner/repo',
          taskId: 't-other',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Deduplication & Technology Detection', () => {
    it('1. Detects technologies from manifests accurately', async () => {
      prismaService.evidenceItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'ev-tech', ...data }),
      );

      jest.spyOn(adapter, 'fetchRepoMetadata').mockResolvedValue({
        owner: 'owner',
        name: 'nest-app',
        fullName: 'owner/nest-app',
        defaultBranch: 'main',
        isPrivate: false,
        htmlUrl: 'https://github.com/owner/nest-app',
      });

      jest
        .spyOn(adapter, 'fetchCommitMetadata')
        .mockResolvedValue({ sha: 'abc123' });

      jest.spyOn(adapter, 'fetchManifestContents').mockResolvedValue([
        {
          filename: 'package.json',
          content:
            '{"dependencies": {"typescript": "^5.0", "@nestjs/core": "^10.0"}}',
        },
        { filename: 'Dockerfile', content: 'FROM node:18' },
      ]);

      const res: any = await service.submitGitHubRepository('user-1', {
        repoUrl: 'https://github.com/owner/nest-app',
      });

      expect(res.metadata.detectedTechnologies).toContain('TypeScript');
      expect(res.metadata.detectedTechnologies).toContain('NestJS');
      expect(res.metadata.detectedTechnologies).toContain('Docker');
    });

    it('2. Is idempotent and updates existing repository-level evidence item', async () => {
      prismaService.evidenceItem.findFirst.mockResolvedValue({
        id: 'ev-existing',
        githubRepo: 'owner/repo',
      });
      prismaService.evidenceItem.update.mockImplementation(
        ({ where, data }: any) => Promise.resolve({ id: where.id, ...data }),
      );

      jest.spyOn(adapter, 'fetchRepoMetadata').mockResolvedValue({
        owner: 'owner',
        name: 'repo',
        fullName: 'owner/repo',
        defaultBranch: 'main',
        isPrivate: false,
        htmlUrl: 'https://github.com/owner/repo',
      });

      jest
        .spyOn(adapter, 'fetchCommitMetadata')
        .mockResolvedValue({ sha: 'abc123' });
      jest.spyOn(adapter, 'fetchManifestContents').mockResolvedValue([]);

      const res = await service.submitGitHubRepository('user-1', {
        repoUrl: 'https://github.com/owner/repo',
      });

      expect(res.id).toBe('ev-existing');
      expect(prismaService.evidenceItem.update).toHaveBeenCalled();
      expect(prismaService.evidenceItem.create).not.toHaveBeenCalled();
    });
  });

  describe('Full Passive GitHub Discovery & Relevance Filter', () => {
    it('1. Enumerates connected account repos and creates EvidenceItem for tech-overlapping repo', async () => {
      prismaService.oAuthAccount.findFirst.mockResolvedValue({
        providerId: 'user1-gh',
        accessToken: 'token-oauth-123',
      });

      prismaService.roadmap.findMany.mockResolvedValue([
        {
          id: 'rm-1',
          userId: 'user-1',
          status: 'ACTIVE',
          snapshots: [
            {
              nodes: [
                {
                  id: 'node-p1',
                  nodeType: RoadmapNodeType.PROJECT,
                  dependencies: ['TypeScript', 'NestJS'],
                  metadata: { requiredSkills: ['TypeScript', 'NestJS'] },
                },
              ],
            },
          ],
        },
      ]);

      // Enumerates 2 repos from user's account
      jest.spyOn(adapter, 'fetchUserRepositories').mockResolvedValue([
        {
          owner: 'user1-gh',
          name: 'nest-backend',
          fullName: 'user1-gh/nest-backend',
          defaultBranch: 'main',
          isPrivate: false,
          htmlUrl: 'https://github.com/user1-gh/nest-backend',
          ownerId: 'user1-gh',
          ownerLogin: 'user1-gh',
        },
        {
          owner: 'user1-gh',
          name: 'unrelated-cooking-blog',
          fullName: 'user1-gh/unrelated-cooking-blog',
          defaultBranch: 'main',
          isPrivate: false,
          htmlUrl: 'https://github.com/user1-gh/unrelated-cooking-blog',
          ownerId: 'user1-gh',
          ownerLogin: 'user1-gh',
        },
      ]);

      jest
        .spyOn(adapter, 'fetchManifestContents')
        .mockImplementation(async (owner, repo) => {
          if (repo === 'nest-backend') {
            return [
              {
                filename: 'package.json',
                content: '{"dependencies": {"@nestjs/core": "^10.0"}}',
              },
            ];
          }
          return []; // Cooking blog has 0 matching manifest tech
        });

      jest
        .spyOn(adapter, 'fetchCommitMetadata')
        .mockResolvedValue({ sha: 'commit-pass-1' });

      prismaService.evidenceItem.findFirst.mockResolvedValue(null);
      prismaService.evidenceItem.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'ev-passive-1', ...data }),
      );

      const res = await service.observePassiveRepositories('user-1');

      expect(res.observedCount).toBe(2);
      expect(res.createdEvidenceCount).toBe(1); // Only nest-backend passed relevance filter!
      expect(prismaService.evidenceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            githubRepo: 'user1-gh/nest-backend',
          }),
        }),
      );
    });

    it('2. Returns zero discovered when user has no connected OAuth account', async () => {
      prismaService.oAuthAccount.findFirst.mockResolvedValue(null);

      const res = await service.observePassiveRepositories('user-1');

      expect(res.observedCount).toBe(0);
      expect(res.reason).toContain('No connected GitHub OAuth account');
    });
  });
});
