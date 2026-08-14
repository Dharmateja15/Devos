export class SubmitGitHubRepoDto {
  repoUrl: string;
  projectId?: string;
  taskId?: string;
  branch?: string;
}

export class GitHubEvidenceResponseDto {
  id: string;
  userId: string;
  evidenceType: string;
  title: string;
  description?: string;
  url: string;
  verified: boolean;
  verifiedAt?: Date;
  githubRepo?: string;
  githubSha?: string;
  githubAuthor?: string;
  githubEventAt?: Date;
  metadata: Record<string, any>;
}
