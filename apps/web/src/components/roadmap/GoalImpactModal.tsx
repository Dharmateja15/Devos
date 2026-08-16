'use client';

import React, { useState, useEffect } from 'react';
import { useIntelligence } from '../../context/IntelligenceContext';
import { GoalChangeImpactResponseDto } from '../../lib/api/intelligence-client';

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
}: GoalImpactModalProps) {
  const { analyzeGoalImpact } = useIntelligence();
  const [targetPriority, setTargetPriority] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [targetGoal, setTargetGoal] = useState<string>('');
  const [addedTech, setAddedTech] = useState<string>('');
  const [removedTech, setRemovedTech] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<GoalChangeImpactResponseDto | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

      const removedTechArray = removedTech
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await analyzeGoalImpact(roadmapId, {
        targetPriority: (targetPriority as any) || undefined,
        targetStatus: (targetStatus as any) || undefined,
        targetRoleOrGoal: targetGoal.trim() || undefined,
        addedTechnologies: addedTechArray.length > 0 ? addedTechArray : undefined,
        removedTechnologies: removedTechArray.length > 0 ? removedTechArray : undefined,
      });

      setIsLoading(false);
      setImpactResult(res);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to analyze goal change impact.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-impact-modal-title"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 id="goal-impact-modal-title" className="text-xl font-bold text-slate-900">
              Goal Change Impact Preview
            </h3>
            <p className="text-xs text-slate-500">Advisory impact analysis for "{roadmapTitle}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Priority
                </label>
                <select
                  value={targetPriority}
                  onChange={e => setTargetPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Keep Current Priority</option>
                  <option value="PRIMARY">PRIMARY</option>
                  <option value="SECONDARY">SECONDARY</option>
                  <option value="EXPLORATORY">EXPLORATORY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={e => setTargetStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Keep Current Status</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Role or Goal Pivot
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Fullstack Engineer (React & Go)"
                value={targetGoal}
                onChange={e => setTargetGoal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Added Target Technologies (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. GraphQL, Docker, Kubernetes"
                value={addedTech}
                onChange={e => setAddedTech(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Removed Technologies (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Legacy JS, PHP"
                value={removedTech}
                onChange={e => setRemovedTech(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              <strong>Preview Only:</strong> Goal Change Impact Analysis generates an advisory summary of affected roadmap topics. It does NOT automatically delete, reorder, or restructure your roadmap nodes or task progress.
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {isLoading ? 'Analyzing Impact...' : 'Run Impact Analysis'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Priority & Status Change Deltas */}
            {(impactResult.previousPriority || impactResult.previousStatus) && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {impactResult.previousPriority && impactResult.newPriority && (
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    Priority: {impactResult.previousPriority} → <span className="text-indigo-600 font-bold">{impactResult.newPriority}</span>
                  </span>
                )}
                {impactResult.previousStatus && impactResult.newStatus && (
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    Status: {impactResult.previousStatus} → <span className="text-indigo-600 font-bold">{impactResult.newStatus}</span>
                  </span>
                )}
              </div>
            )}

            {/* Analysis Summary */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider mb-1">Analysis Summary</h4>
              <p className="text-xs text-indigo-900 leading-relaxed">{impactResult.summaryExplanation}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {impactResult.affectedNodesCount !== undefined && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-lg font-bold text-slate-900">{impactResult.affectedNodesCount}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Nodes Evaluated</span>
                </div>
              )}
              {impactResult.activeMaterializedTasksCount !== undefined && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-lg font-bold text-slate-900">{impactResult.activeMaterializedTasksCount}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Tasks</span>
                </div>
              )}
              {impactResult.estimatedTimelineDeltaDays !== undefined && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="block text-lg font-bold text-slate-900">
                    {impactResult.estimatedTimelineDeltaDays > 0 ? `+${impactResult.estimatedTimelineDeltaDays}` : impactResult.estimatedTimelineDeltaDays} d
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Timeline Delta</span>
                </div>
              )}
            </div>

            {/* Deprioritized Tasks */}
            {Boolean(impactResult.deprioritizedTasks && impactResult.deprioritizedTasks.length > 0) && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Deprioritized Focus Tasks ({impactResult.deprioritizedTasks?.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {impactResult.deprioritizedTasks?.map(task => (
                    <div key={task.taskId} className="flex items-center justify-between p-2 bg-white/80 rounded border border-amber-200/60">
                      <span className="font-medium text-amber-900">{task.title}</span>
                      <span className="text-[11px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Score: {task.newFocusScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retained Useful Tasks */}
            {Boolean(impactResult.retainedUsefulTasks && impactResult.retainedUsefulTasks.length > 0) && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Retained Active Tasks ({impactResult.retainedUsefulTasks?.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {impactResult.retainedUsefulTasks?.map(task => (
                    <div key={task.taskId} className="p-2 bg-white/80 rounded border border-emerald-200/60">
                      <div className="font-semibold text-emerald-950">{task.title}</div>
                      <div className="text-[11px] text-emerald-800 mt-0.5">{task.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prerequisites Affected */}
            {Boolean(impactResult.prerequisitesAffected && impactResult.prerequisitesAffected.length > 0) && (
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                  Prerequisites Affected ({impactResult.prerequisitesAffected?.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {impactResult.prerequisitesAffected?.map(prereq => (
                    <div key={prereq.nodeId} className="p-2 bg-white/80 rounded border border-purple-200/60">
                      <div className="font-semibold text-purple-950">{prereq.nodeTitle}</div>
                      <div className="text-[11px] text-purple-800 mt-0.5">{prereq.impactDescription}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Newly Required Capabilities */}
            {Boolean(impactResult.newlyRequiredCapabilities && impactResult.newlyRequiredCapabilities.length > 0) && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Newly Required Capabilities ({impactResult.newlyRequiredCapabilities?.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {impactResult.newlyRequiredCapabilities?.map((cap, i) => (
                    <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      + {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Adjustments */}
            {Boolean(impactResult.recommendedAdjustments && impactResult.recommendedAdjustments.length > 0) && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Recommended Adjustments
                </h4>
                <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {impactResult.recommendedAdjustments?.map((adj, i) => (
                    <li key={i}>{adj}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImpactResult(null)}
                className="text-xs font-medium text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
              >
                ← Run Another Analysis
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
