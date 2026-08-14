'use client';

import React, { useState } from 'react';
import { submitGitHubRepoEvidence, GitHubEvidenceResponseDto } from '../../lib/api/evidence-client';

interface ProjectSubmissionModalProps {
  nodeTitle: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: GitHubEvidenceResponseDto) => void;
  accessToken: string | null;
}

export function ProjectSubmissionModal({
  nodeTitle,
  projectId,
  isOpen,
  onClose,
  onSuccess,
  accessToken,
}: ProjectSubmissionModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<GitHubEvidenceResponseDto | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('GitHub repository URL is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await submitGitHubRepoEvidence(
        {
          repoUrl: repoUrl.trim(),
          projectId: projectId || undefined,
          branch: branch.trim() || undefined,
        },
        accessToken
      );

      setIsLoading(false);
      setSubmissionResult(result);
      onSuccess(result);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to submit GitHub repository evidence.');
    }
  };

  const getVerificationLabel = (status?: string) => {
    switch (status) {
      case 'REPOSITORY_OWNER_VERIFIED':
        return { label: 'Verified Repo Owner', bg: 'bg-emerald-100 text-emerald-800' };
      case 'CONNECTED_ACCOUNT_ASSOCIATION':
        return { label: 'Connected Account Match', bg: 'bg-blue-100 text-blue-800' };
      case 'COMMIT_AUTHOR_MATCH':
        return { label: 'Commit Author Match', bg: 'bg-purple-100 text-purple-800' };
      case 'PUBLIC_REPOSITORY_SUBMISSION':
      default:
        return { label: 'Public Repo Submission', bg: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Submit GitHub Evidence</h3>
            <p className="text-xs text-slate-500">Provide repository evidence for "{nodeTitle}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
            {error}
          </div>
        )}

        {!submissionResult ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                GitHub Repository URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Must be a valid public GitHub repository or connected OAuth repository.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Branch (Optional)
              </label>
              <input
                type="text"
                placeholder="main"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs text-indigo-900 leading-relaxed">
              <strong>Evidence Verification:</strong> Submitting a repository creates a verified evidence record and re-evaluates your roadmap project gap intelligence. It does NOT automatically grant mastery or mark your node completed.
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? 'Verifying Repository...' : 'Submit Evidence'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <h4 className="text-sm font-bold text-emerald-950">Evidence Submitted Successfully</h4>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Repository "{submissionResult.title}" has been recorded. Project gap status will update automatically.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Verification Status:</span>
                {(() => {
                  const status = submissionResult.metadata?.verificationStatus;
                  const v = getVerificationLabel(status);
                  return <span className={`font-semibold px-2 py-0.5 rounded ${v.bg}`}>{v.label}</span>;
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Repository:</span>
                <span className="font-mono text-slate-800">{submissionResult.githubRepo || submissionResult.url}</span>
              </div>
              {submissionResult.metadata?.detectedTechnologies?.length > 0 && (
                <div>
                  <span className="text-slate-500 block mb-1">Detected Tech Stack:</span>
                  <div className="flex flex-wrap gap-1">
                    {submissionResult.metadata.detectedTechnologies.map((tech: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] text-slate-700">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
