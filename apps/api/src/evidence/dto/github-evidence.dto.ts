import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitGitHubRepoDto {
  @IsString()
  @IsNotEmpty()
  repoUrl: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
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
