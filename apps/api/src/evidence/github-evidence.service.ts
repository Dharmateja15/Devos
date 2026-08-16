import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GitHubClientAdapter,
  ManifestFileContent,
  GitHubRepoMetadata,
} from './github-client.adapter';
import { SubmitGitHubRepoDto } from './dto/github-evidence.dto';
import { EvidenceType, AuthProvider, RoadmapNodeType } from '@prisma/client';
import { decryptToken } from '../common/crypto.util';

export enum GitHubVerificationStatus {
  REPOSITORY_OWNER_VERIFIED = 'REPOSITORY_OWNER_VERIFIED',
  CONNECTED_ACCOUNT_ASSOCIATION = 'CONNECTED_ACCOUNT_ASSOCIATION',
  COMMIT_AUTHOR_MATCH = 'COMMIT_AUTHOR_MATCH',
  PUBLIC_REPOSITORY_SUBMISSION = 'PUBLIC_REPOSITORY_SUBMISSION',
}

@Injectable()
export class GitHubEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAdapter: GitHubClientAdapter,
  ) {}

  /**
   * Primary Endpoint Implementation: Submit GitHub Repository Evidence
   */
  async submitGitHubRepository(userId: string, dto: SubmitGitHubRepoDto) {
    // 1. Validate & Parse URL (SSRF Safe)
    const { owner, repo } = this.githubAdapter.parseAndSanitizeGitHubUrl(
      dto.repoUrl,
    );
    const normalizedRepo = `${owner}/${repo}`.toLowerCase();

    // 2. Explicit Ownership Validation for projectId and taskId
    let validatedJourneyId: string | undefined;
    let validatedProjectId: string | undefined;
    let validatedTaskId: string | undefined;

    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        include: { journey: true },
      });
      if (!project || project.deletedAt || project.journey.deletedAt) {
        throw new NotFoundException(
          `Project with ID ${dto.projectId} not found.`,
        );
      }
      if (project.journey.userId !== userId) {
        throw new ForbiddenException('You do not own the specified project.');
      }
      validatedProjectId = project.id;
      validatedJourneyId = project.journeyId;
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: dto.taskId },
        include: { journey: true },
      });
      if (!task || task.deletedAt || task.journey.deletedAt) {
        throw new NotFoundException(`Task with ID ${dto.taskId} not found.`);
      }
      if (task.journey.userId !== userId) {
        throw new ForbiddenException('You do not own the specified task.');
      }
      if (validatedJourneyId && task.journeyId !== validatedJourneyId) {
        throw new BadRequestException(
          'Specified taskId and projectId belong to different journeys.',
        );
      }
      validatedTaskId = task.id;
      validatedJourneyId = task.journeyId;
    }

    // 3. Retrieve Connected GitHub OAuth Account for user (if exists)
    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: AuthProvider.GITHUB,
      },
    });

    const accessToken = oauthAccount?.accessToken
      ? decryptToken(oauthAccount.accessToken) || undefined
      : undefined;

    // 4. Fetch GitHub Repository & Commit Metadata via Adapter
    const repoMeta = await this.githubAdapter.fetchRepoMetadata(
      owner,
      repo,
      accessToken,
    );
    const commitMeta = await this.githubAdapter.fetchCommitMetadata(
      owner,
      repo,
      undefined,
      accessToken,
    );

    // 5. Determine Identity Verification Status
    const { verificationStatus, isVerified, identityNotes } =
      this.determineVerificationStatus(oauthAccount, repoMeta, commitMeta);

    // 6. Fetch Static Manifests & Detect Technologies
    const manifests = await this.githubAdapter.fetchManifestContents(
      owner,
      repo,
      accessToken,
    );
    const detectedTechnologies =
      this.detectTechnologiesFromManifests(manifests);

    // 7. Deduplicate & Persist EvidenceItem (Repository-level: githubSha is null)
    const existingEvidence = await this.prisma.evidenceItem.findFirst({
      where: {
        userId,
        githubRepo: normalizedRepo,
        evidenceType: EvidenceType.GITHUB_REPO,
        deletedAt: null,
      },
    });

    const metadataPayload = {
      source: 'GITHUB',
      verificationStatus,
      identityNotes,
      detectedTechnologies,
      defaultBranch: repoMeta.defaultBranch,
      isPrivate: repoMeta.isPrivate,
      latestCommitSha: commitMeta.sha,
      inspectedManifests: manifests.map((m) => m.filename),
      whyReason: `Submitted repository ${repoMeta.fullName} inspected. Detected tech stack: [${detectedTechnologies.join(', ')}]. Verification status: ${verificationStatus}.`,
    };

    let evidence;

    if (existingEvidence) {
      evidence = await this.prisma.evidenceItem.update({
        where: { id: existingEvidence.id },
        data: {
          title: `GitHub Repository: ${repoMeta.fullName}`,
          description: repoMeta.description || existingEvidence.description,
          url: repoMeta.htmlUrl,
          verified: isVerified,
          verifiedAt: isVerified ? new Date() : existingEvidence.verifiedAt,
          projectId: validatedProjectId || existingEvidence.projectId,
          taskId: validatedTaskId || existingEvidence.taskId,
          journeyId: validatedJourneyId || existingEvidence.journeyId,
          githubRepo: normalizedRepo,
          githubAuthor:
            commitMeta.authorGitHubLogin || commitMeta.authorName || owner,
          githubEventAt: commitMeta.committedAt
            ? new Date(commitMeta.committedAt)
            : new Date(),
          metadata: metadataPayload,
        },
      });
    } else {
      evidence = await this.prisma.evidenceItem.create({
        data: {
          userId,
          journeyId: validatedJourneyId || null,
          projectId: validatedProjectId || null,
          taskId: validatedTaskId || null,
          evidenceType: EvidenceType.GITHUB_REPO,
          title: `GitHub Repository: ${repoMeta.fullName}`,
          description:
            repoMeta.description ||
            `Repository evidence for ${repoMeta.fullName}`,
          url: repoMeta.htmlUrl,
          verified: isVerified,
          verifiedAt: isVerified ? new Date() : null,
          githubRepo: normalizedRepo,
          githubSha: null,
          githubAuthor:
            commitMeta.authorGitHubLogin || commitMeta.authorName || owner,
          githubEventAt: commitMeta.committedAt
            ? new Date(commitMeta.committedAt)
            : new Date(),
          metadata: metadataPayload,
        },
      });
    }

    // 8. Emit Outbox Event
    await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'EVIDENCE',
        aggregateId: evidence.id,
        eventType: 'evidence.github_discovered',
        payload: {
          evidenceId: evidence.id,
          userId,
          githubRepo: normalizedRepo,
          verificationStatus,
          detectedTechnologies,
        },
        userId,
      },
    });

    return evidence;
  }

  /**
   * Requirement I: Full Passive GitHub Discovery via Account Enumeration & Relevance Filtering
   */
  async observePassiveRepositories(userId: string) {
    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: AuthProvider.GITHUB },
    });

    if (!oauthAccount || !oauthAccount.accessToken) {
      return {
        observedCount: 0,
        createdEvidenceCount: 0,
        reason: 'No connected GitHub OAuth account.',
      };
    }

    // 1. Enumerate connected account repositories via GET /user/repos
    const userRepos: GitHubRepoMetadata[] =
      await this.githubAdapter.fetchUserRepositories(oauthAccount.accessToken);

    if (userRepos.length === 0) {
      return {
        observedCount: 0,
        createdEvidenceCount: 0,
        reason: 'No repositories found for connected GitHub account.',
      };
    }

    // 2. Fetch learner's active roadmaps, project nodes, and existing projects for deterministic relevance matching
    const activeRoadmaps = await this.prisma.roadmap.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      include: {
        snapshots: {
          take: 1,
          orderBy: { importedAt: 'desc' },
          include: { nodes: true },
        },
      },
    });

    const userProjects = await this.prisma.project.findMany({
      where: { journey: { userId }, deletedAt: null },
    });

    // Collect required technology signals from active project nodes and user projects
    const targetTechStack = new Set<string>();
    activeRoadmaps.forEach((rm) => {
      rm.snapshots[0]?.nodes.forEach((n) => {
        if (n.nodeType === RoadmapNodeType.PROJECT) {
          if (n.dependencies)
            n.dependencies.forEach((d) => targetTechStack.add(d.toLowerCase()));
          const metaSkills = (n.metadata as Record<string, any>)
            ?.requiredSkills;
          if (Array.isArray(metaSkills))
            metaSkills.forEach((s) =>
              targetTechStack.add(String(s).toLowerCase()),
            );
        }
      });
    });

    userProjects.forEach((p) => {
      p.techStack.forEach((t) => targetTechStack.add(t.toLowerCase()));
    });

    const existingProjectRepoUrls = new Set(
      userProjects.map((p) => p.repoUrl?.toLowerCase()).filter(Boolean),
    );

    let createdEvidenceCount = 0;

    // 3. Inspect each repository and apply Deterministic Relevance Filter
    for (const repoMeta of userRepos) {
      const normalizedRepo = repoMeta.fullName.toLowerCase();
      const repoUrlLower = repoMeta.htmlUrl.toLowerCase();

      // Check Signal 1: Explicit Project.repoUrl match
      const isExplicitProjectMatch = existingProjectRepoUrls.has(repoUrlLower);

      // Fetch manifests to check Signal 2: Manifest/Technology Overlap
      const manifests = await this.githubAdapter.fetchManifestContents(
        repoMeta.owner,
        repoMeta.name,
        oauthAccount.accessToken,
      );
      const detectedTechnologies =
        this.detectTechnologiesFromManifests(manifests);

      const hasTechOverlap = detectedTechnologies.some((tech) =>
        targetTechStack.has(tech.toLowerCase()),
      );

      // Deterministic Passive Relevance Filter:
      // Must have either explicit Project.repoUrl match OR verified technology manifest overlap!
      // Weak repository name matches alone are REJECTED to prevent noise!
      if (!isExplicitProjectMatch && !hasTechOverlap) {
        continue;
      }

      // 4. Create/update user-scoped EvidenceItem for qualified repository
      const commitMeta = await this.githubAdapter.fetchCommitMetadata(
        repoMeta.owner,
        repoMeta.name,
        undefined,
        oauthAccount.accessToken,
      );

      const { verificationStatus, isVerified, identityNotes } =
        this.determineVerificationStatus(oauthAccount, repoMeta, commitMeta);

      const existingEvidence = await this.prisma.evidenceItem.findFirst({
        where: {
          userId,
          githubRepo: normalizedRepo,
          evidenceType: EvidenceType.GITHUB_REPO,
          deletedAt: null,
        },
      });

      const metadataPayload = {
        source: 'GITHUB_PASSIVE_DISCOVERY',
        verificationStatus,
        identityNotes,
        detectedTechnologies,
        defaultBranch: repoMeta.defaultBranch,
        isPrivate: repoMeta.isPrivate,
        latestCommitSha: commitMeta.sha,
        inspectedManifests: manifests.map((m) => m.filename),
        whyReason: `Passively discovered repository ${repoMeta.fullName} passed deterministic relevance filter. Detected tech stack: [${detectedTechnologies.join(', ')}]. Verification status: ${verificationStatus}.`,
      };

      if (!existingEvidence) {
        const newEvidence = await this.prisma.evidenceItem.create({
          data: {
            userId,
            evidenceType: EvidenceType.GITHUB_REPO,
            title: `GitHub Repository: ${repoMeta.fullName}`,
            description:
              repoMeta.description ||
              `Passively discovered repository ${repoMeta.fullName}`,
            url: repoMeta.htmlUrl,
            verified: isVerified,
            verifiedAt: isVerified ? new Date() : null,
            githubRepo: normalizedRepo,
            githubSha: null,
            githubAuthor:
              commitMeta.authorGitHubLogin ||
              commitMeta.authorName ||
              repoMeta.owner,
            githubEventAt: commitMeta.committedAt
              ? new Date(commitMeta.committedAt)
              : new Date(),
            metadata: metadataPayload,
          },
        });

        await this.prisma.outboxEvent.create({
          data: {
            aggregateType: 'EVIDENCE',
            aggregateId: newEvidence.id,
            eventType: 'evidence.github_discovered',
            payload: {
              evidenceId: newEvidence.id,
              userId,
              githubRepo: normalizedRepo,
              verificationStatus,
              detectedTechnologies,
            },
            userId,
          },
        });

        createdEvidenceCount++;
      }
    }

    return {
      observedCount: userRepos.length,
      createdEvidenceCount,
      reason: `Enumerated ${userRepos.length} connected GitHub repositories. Created ${createdEvidenceCount} relevant evidence items based on manifest technology overlap and project matching.`,
    };
  }

  /**
   * Revision Correction 1: Deterministic Identity Verification Logic
   */
  private determineVerificationStatus(
    oauthAccount: any,
    repoMeta: GitHubRepoMetadata,
    commitMeta: any,
  ): {
    verificationStatus: GitHubVerificationStatus;
    isVerified: boolean;
    identityNotes: string;
  } {
    if (!oauthAccount) {
      return {
        verificationStatus:
          GitHubVerificationStatus.PUBLIC_REPOSITORY_SUBMISSION,
        isVerified: false,
        identityNotes:
          'No connected GitHub OAuth account found. Evidence recorded as unverified public submission.',
      };
    }

    const connectedProviderId = oauthAccount.providerId;

    // 1. REPOSITORY_OWNER_VERIFIED: OAuth providerId matches repo ownerId or repo ownerLogin
    if (
      (repoMeta.ownerId && repoMeta.ownerId === connectedProviderId) ||
      (repoMeta.ownerLogin &&
        repoMeta.ownerLogin.toLowerCase() === connectedProviderId.toLowerCase())
    ) {
      return {
        verificationStatus: GitHubVerificationStatus.REPOSITORY_OWNER_VERIFIED,
        isVerified: true,
        identityNotes: `Connected OAuth account (${connectedProviderId}) is verified as repository owner.`,
      };
    }

    // 2. CONNECTED_ACCOUNT_ASSOCIATION: Repo belongs to user's account namespace
    if (
      repoMeta.fullName
        .toLowerCase()
        .startsWith(`${connectedProviderId.toLowerCase()}/`)
    ) {
      return {
        verificationStatus:
          GitHubVerificationStatus.CONNECTED_ACCOUNT_ASSOCIATION,
        isVerified: true,
        identityNotes: `Repository namespace matches connected GitHub OAuth account (${connectedProviderId}).`,
      };
    }

    // 3. COMMIT_AUTHOR_MATCH: Canonical GitHub user ID or Login matches OAuth providerId
    if (
      (commitMeta.authorGitHubId &&
        commitMeta.authorGitHubId === connectedProviderId) ||
      (commitMeta.authorGitHubLogin &&
        commitMeta.authorGitHubLogin.toLowerCase() ===
          connectedProviderId.toLowerCase())
    ) {
      return {
        verificationStatus: GitHubVerificationStatus.COMMIT_AUTHOR_MATCH,
        isVerified: true,
        identityNotes: `Commit author GitHub ID/login (${commitMeta.authorGitHubLogin}) matches connected OAuth account.`,
      };
    }

    // Note: Email equality alone is NOT sufficient for verified identity.
    const emailMatchNote = commitMeta.authorEmail
      ? ` Commit email (${commitMeta.authorEmail}) recorded as supporting metadata only.`
      : '';

    return {
      verificationStatus: GitHubVerificationStatus.PUBLIC_REPOSITORY_SUBMISSION,
      isVerified: false,
      identityNotes: `Repository owner or commit author (${commitMeta.authorGitHubLogin || 'unknown'}) does not authoritatively match connected OAuth account (${connectedProviderId}).${emailMatchNote}`,
    };
  }

  /**
   * Deterministic Manifest Technology Detector
   */
  private detectTechnologiesFromManifests(
    manifests: ManifestFileContent[],
  ): string[] {
    const detected = new Set<string>();

    for (const file of manifests) {
      const name = file.filename.toLowerCase();
      const content = file.content.toLowerCase();

      if (name === 'package.json') {
        detected.add('Node.js');
        if (content.includes('"typescript"')) detected.add('TypeScript');
        if (content.includes('"react"')) detected.add('React');
        if (content.includes('"next"')) detected.add('Next.js');
        if (content.includes('"@nestjs/core"')) detected.add('NestJS');
        if (content.includes('"express"')) detected.add('Express');
        if (
          content.includes('"prisma"') ||
          content.includes('"@prisma/client"')
        )
          detected.add('Prisma');
        if (content.includes('"tailwindcss"')) detected.add('TailwindCSS');
      }

      if (name === 'requirements.txt' || name === 'pyproject.toml') {
        detected.add('Python');
        if (content.includes('fastapi')) detected.add('FastAPI');
        if (content.includes('django')) detected.add('Django');
        if (content.includes('flask')) detected.add('Flask');
        if (content.includes('torch') || content.includes('pytorch'))
          detected.add('PyTorch');
        if (content.includes('tensorflow')) detected.add('TensorFlow');
      }

      if (name === 'dockerfile' || name === 'docker-compose.yml') {
        detected.add('Docker');
        detected.add('Containerization');
      }

      if (name === 'go.mod') {
        detected.add('Go');
      }

      if (name === 'cargo.toml') {
        detected.add('Rust');
      }
    }

    return Array.from(detected);
  }
}
