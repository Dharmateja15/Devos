const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SubmitGitHubRepoPayload {
  repoUrl: string;
  projectId?: string;
  taskId?: string;
  branch?: string;
}

export interface GitHubEvidenceResponseDto {
  id: string;
  userId: string;
  evidenceType: string;
  title: string;
  description?: string;
  url: string;
  verified: boolean;
  verifiedAt?: string;
  githubRepo?: string;
  githubSha?: string;
  githubAuthor?: string;
  githubEventAt?: string;
  metadata: Record<string, any>;
}

function getHeaders(accessToken?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Submits GitHub repository evidence to the backend via POST /api/v1/evidence/github-repo
 */
export async function submitGitHubRepoEvidence(
  payload: SubmitGitHubRepoPayload,
  accessToken?: string | null
): Promise<GitHubEvidenceResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/evidence/github-repo`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMessage = 'Failed to submit GitHub repository evidence.';
    try {
      const errorData = await res.json();
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Fallback to HTTP status text
    }

    const error = new Error(errorMessage) as any;
    error.status = res.status;
    throw error;
  }

  return res.json();
}
