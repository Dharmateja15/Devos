'use client';

import React, { useState } from 'react';
import { analyzeGoalChangeImpact, GoalChangeImpactResponseDto } from '../../lib/api/intelligence-client';

interface GoalImpactModalProps {
  roadmapId: string;
  roadmapTitle: string;
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
}

export function GoalImpactModal({
  roadmapId,
  roadmapTitle,
  isOpen,
  onClose,
  accessToken,
}: GoalImpactModalProps) {
  const [targetGoal, setTargetGoal] = useState('');
  const [addedTech, setAddedTech] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<GoalChangeImpactResponseDto | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const addedTechArray = addedTech
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await analyzeGoalChangeImpact(
        roadmapId,
        {
          targetRoleOrGoal: targetGoal.trim() || undefined,
          addedTechnologies: addedTechArray.length > 0 ? addedTechArray : undefined,
        },
        accessToken
      );
      setIsLoading(false);
      setImpactResult(res);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to analyze goal change impact.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Goal Change Impact Preview</h3>
            <p className="text-xs text-slate-500">Advisory impact analysis for "{roadmapTitle}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
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

        {!impactResult ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Role or Goal Pivot
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Fullstack Engineer (React & Go)"
                value={targetGoal}
                onChange={e => setTargetGoal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Added Target Technologies (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. GraphQL, Docker, Kubernetes"
                value={addedTech}
                onChange={e => setAddedTech(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              <strong>Preview Only:</strong> Goal Change Impact Analysis generates an advisory summary of affected roadmap topics. It does NOT automatically delete, reorder, or restructure your roadmap nodes.
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
                {isLoading ? 'Analyzing Impact...' : 'Run Impact Analysis'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <h4 className="text-sm font-bold text-indigo-950 mb-1">Analysis Summary</h4>
              <p className="text-xs text-indigo-900 leading-relaxed">{impactResult.summaryExplanation}</p>
            </div>

            {impactResult.newlyRequiredCapabilities.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Newly Required Capabilities ({impactResult.newlyRequiredCapabilities.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {impactResult.newlyRequiredCapabilities.map((cap, i) => (
                    <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      + {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {impactResult.recommendedAdjustments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Recommended Adjustments
                </h4>
                <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {impactResult.recommendedAdjustments.map((adj, i) => (
                    <li key={i}>{adj}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImpactResult(null)}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                ← Run Another Analysis
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
