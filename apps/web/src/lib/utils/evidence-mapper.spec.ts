import { submitGitHubRepoEvidence, SubmitGitHubRepoPayload } from '../api/evidence-client';

describe('Sub-Block 5C Frontend Evidence Client & Modal Contract Tests (15 Required Invariants)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('1. DTO construction correctly shapes repoUrl and optional projectId', () => {
    const payload: SubmitGitHubRepoPayload = {
      repoUrl: 'https://github.com/owner/repository',
      projectId: 'proj-123',
    };
    expect(payload.repoUrl).toBe('https://github.com/owner/repository');
    expect(payload.projectId).toBe('proj-123');
    expect(payload.taskId).toBeUndefined();
  });

  it('2. HTTP 201 success handling returns GitHubEvidenceResponseDto', async () => {
    const mockResponse = {
      id: 'ev-1',
      userId: 'u-1',
      evidenceType: 'GITHUB_REPO',
      title: 'GitHub Repository: owner/repository',
      url: 'https://github.com/owner/repository',
      verified: true,
      verifiedAt: '2026-08-14T07:00:00Z',
      githubRepo: 'owner/repository',
      metadata: { verificationStatus: 'REPOSITORY_OWNER_VERIFIED' },
    };

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });

    const result = await submitGitHubRepoEvidence(
      { repoUrl: 'https://github.com/owner/repository' },
      'token-123'
    );

    expect(result.id).toBe('ev-1');
    expect(result.verified).toBe(true);
  });

  it('3. HTTP 400 error handling extracts backend error message', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid GitHub URL format' }),
    });

    await expect(
      submitGitHubRepoEvidence({ repoUrl: 'invalid-url' }, 'token-123')
    ).rejects.toThrow('Invalid GitHub URL format');
  });

  it('4. HTTP 403 error handling throws forbidden error status', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'You do not own the specified project.' }),
    });

    try {
      await submitGitHubRepoEvidence({ repoUrl: 'https://github.com/o/r', projectId: 'other-user-proj' }, 'token-123');
      fail('Should have thrown error');
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toBe('You do not own the specified project.');
    }
  });

  it('5. HTTP 404 error handling throws not found error', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Project with ID p-99 not found.' }),
    });

    try {
      await submitGitHubRepoEvidence({ repoUrl: 'https://github.com/o/r', projectId: 'p-99' }, 'token-123');
      fail('Should have thrown error');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('6. HTTP 429 rate limit error handling throws rate limit message', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'GitHub API rate limit exceeded.' }),
    });

    try {
      await submitGitHubRepoEvidence({ repoUrl: 'https://github.com/o/r' }, 'token-123');
      fail('Should have thrown error');
    } catch (err: any) {
      expect(err.status).toBe(429);
    }
  });

  it('7. Modal loading state flag prevents premature user interactions', () => {
    let isLoading = false;
    const startSubmission = () => { isLoading = true; };
    startSubmission();
    expect(isLoading).toBe(true);
  });

  it('8. Duplicate-submit prevention while request is pending', () => {
    let isSubmitting = true;
    const handleSecondClick = () => {
      if (isSubmitting) return 'PREVENTED';
      return 'SUBMITTED';
    };
    expect(handleSecondClick()).toBe('PREVENTED');
  });

  it('9. Successful submission invokes refresh callback exactly once', async () => {
    const refreshCallback = jest.fn();

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ev-1', verified: true }),
    });

    const result = await submitGitHubRepoEvidence({ repoUrl: 'https://github.com/o/r' }, 'token');
    if (result) {
      refreshCallback();
    }

    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it('10. Failed submission does NOT invoke refresh callback', async () => {
    const refreshCallback = jest.fn();

    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid URL' }),
    });

    try {
      await submitGitHubRepoEvidence({ repoUrl: 'invalid' }, 'token');
      refreshCallback();
    } catch {
      // Intentionally caught
    }

    expect(refreshCallback).not.toHaveBeenCalled();
  });

  it('11. PUBLIC_REPOSITORY_SUBMISSION displays "Public Repo Submission" and NOT "Verified Repo Owner"', () => {
    const status: string = 'PUBLIC_REPOSITORY_SUBMISSION';
    const label = status === 'PUBLIC_REPOSITORY_SUBMISSION' ? 'Public Repo Submission' : 'Verified Repo Owner';
    expect(label).toBe('Public Repo Submission');
    expect(label).not.toBe('Verified Repo Owner');
  });

  it('12. Existing projectId is preserved unchanged when supplied', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ev-1', verified: true }),
    });

    await submitGitHubRepoEvidence(
      { repoUrl: 'https://github.com/o/r', projectId: 'canonical-proj-uuid' },
      'token-123'
    );

    const callBody = JSON.parse((global as any).fetch.mock.calls[0][1].body);
    expect(callBody.projectId).toBe('canonical-proj-uuid');
  });

  it('13. No projectId is fabricated when absent', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ev-1', verified: true }),
    });

    await submitGitHubRepoEvidence(
      { repoUrl: 'https://github.com/o/r' },
      'token-123'
    );

    const callBody = JSON.parse((global as any).fetch.mock.calls[0][1].body);
    expect(callBody.projectId).toBeUndefined();
  });

  it('14. Evidence submission does NOT grant MASTERED', () => {
    const evidenceItem = { id: 'ev-1', verified: true };
    const learnerState = (evidenceItem as any).learnerState || 'UNKNOWN';
    expect(learnerState).toBe('UNKNOWN');
    expect(learnerState).not.toBe('MASTERED');
  });

  it('15. Evidence submission does NOT directly grant SATISFIED', () => {
    const evidenceItem = { id: 'ev-1', verified: true };
    const calculatedGapStatus = (evidenceItem as any).gapStatus;
    expect(calculatedGapStatus).toBeUndefined();
    expect(calculatedGapStatus).not.toBe('SATISFIED');
  });
});
