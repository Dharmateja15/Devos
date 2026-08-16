import React from 'react';
import Link from 'next/link';
import { RoadmapDto } from '../../lib/api/roadmap-client';
import { PaceAdaptationDto, CapabilityFreshnessResponseDto } from '../../lib/api/intelligence-client';
import { useIntelligence } from '../../context/IntelligenceContext';

interface RoadmapHeaderProps {
  roadmap: RoadmapDto;
  nodeCount: number;
  completedCount: number;
  paceAdaptation?: PaceAdaptationDto | null;
  freshnessSummary?: CapabilityFreshnessResponseDto['summary'] | null;
  conflictsCount?: number;
  onOpenGoalImpactModal?: () => void;
}

export function RoadmapHeader({
  roadmap,
  nodeCount,
  completedCount,
  paceAdaptation: propsPaceAdaptation,
  freshnessSummary: propsFreshnessSummary,
  conflictsCount: propsConflictsCount,
  onOpenGoalImpactModal,
}: RoadmapHeaderProps) {
  const {
    freshnessSummary: contextFreshnessSummary,
    conflicts: contextConflicts,
    paceAdaptation: contextPaceAdaptation,
    projectGaps: contextProjectGaps,
    freshnessRecommendations: contextFreshnessRecommendations,
    isLoading: isIntelLoading,
    error: intelError,
  } = useIntelligence();

  // Fallback to props overrides if explicitly supplied, otherwise use context state
  const freshnessSummary = propsFreshnessSummary !== undefined ? propsFreshnessSummary : contextFreshnessSummary;
  const conflictsCount = propsConflictsCount !== undefined ? propsConflictsCount : contextConflicts.length;
  const paceAdaptation = propsPaceAdaptation !== undefined ? propsPaceAdaptation : contextPaceAdaptation;
  const missingGapsCount = contextProjectGaps.filter(g => g.gapStatus === 'MISSING').length;
  const recsCount = contextFreshnessRecommendations.length;

  const progressPercent = nodeCount > 0 ? Math.round((completedCount / nodeCount) * 100) : 0;

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Breadcrumb & Title */}
        <div className="flex items-center gap-3">
          <Link
            href="/roadmaps"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← My Roadmaps
          </Link>
          <span className="text-slate-300">/</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{roadmap.title}</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {roadmap.status}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {roadmap.priority}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive Learning Roadmap Workspace
            </p>
          </div>
        </div>

        {/* Intelligence & Progress Bar Summary */}
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {/* Phase 5B Real-Time Intelligence Summary Strip */}
          <div
            className="flex flex-wrap items-center gap-2 text-xs border-slate-200 md:border-r md:pr-6"
            role="status"
            aria-live="polite"
            aria-label="Roadmap Intelligence Summary"
          >
            {/* Loading State Skeletons */}
            {isIntelLoading && !freshnessSummary && !paceAdaptation && (
              <div className="flex items-center gap-2" aria-label="Loading intelligence summary">
                <div className="h-6 w-24 bg-slate-200 animate-pulse rounded-lg" />
                <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-lg" />
              </div>
            )}

            {/* Non-Blocking Error State Indicator */}
            {!isIntelLoading && intelError && !freshnessSummary && !paceAdaptation && (
              <div
                className="flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-lg border border-slate-200"
                title={`Intelligence load error: ${intelError}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                <span>Intelligence Offline</span>
              </div>
            )}

            {/* Knowledge Freshness Summary Badge */}
            {freshnessSummary && (
              <div
                className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200"
                title={`Knowledge Freshness: ${freshnessSummary.freshCount} Fresh, ${freshnessSummary.staleCount} Stale, ${freshnessSummary.agingCount} Aging`}
                aria-label={`Knowledge Freshness: ${freshnessSummary.freshCount} Fresh, ${freshnessSummary.staleCount} Stale`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="font-medium text-slate-700">
                  Freshness: {freshnessSummary.freshCount} Fresh
                  {freshnessSummary.staleCount > 0 && (
                    <span className="text-red-600 font-semibold ml-1">· {freshnessSummary.staleCount} Stale</span>
                  )}
                  {freshnessSummary.staleCount === 0 && freshnessSummary.agingCount > 0 && (
                    <span className="text-amber-600 font-semibold ml-1">· {freshnessSummary.agingCount} Aging</span>
                  )}
                </span>
              </div>
            )}

            {/* Evidence Conflicts Alert Badge */}
            {conflictsCount > 0 && (
              <div
                className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-amber-800"
                title={`${conflictsCount} Evidence conflict(s) require review`}
                aria-label={`${conflictsCount} Evidence conflicts require review`}
              >
                <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">{conflictsCount} Conflict{conflictsCount > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Pace Adaptation Badge */}
            {paceAdaptation && (
              <div
                className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-800"
                title={`Pace Adaptation: ${paceAdaptation.paceState}. Suggested velocity: ${paceAdaptation.suggestedBatchSize} tasks/week.`}
                aria-label={`Pace Adaptation: ${paceAdaptation.paceState}, ${paceAdaptation.suggestedBatchSize} tasks per week`}
              >
                <span className="font-semibold">Pace: {paceAdaptation.paceState}</span>
                <span className="text-purple-600 text-[11px]">({paceAdaptation.suggestedBatchSize}/wk)</span>
              </div>
            )}

            {/* Project Gaps Signal Badge */}
            {missingGapsCount > 0 && (
              <div
                className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-800"
                title={`${missingGapsCount} Project Gap(s) detected in roadmap requirement nodes`}
                aria-label={`${missingGapsCount} Project Gaps detected`}
              >
                <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="font-semibold">{missingGapsCount} Project Gap{missingGapsCount > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Freshness Recommendations Signal Badge */}
            {recsCount > 0 && (
              <div
                className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-800"
                title={`${recsCount} Freshness Recommendation(s) available`}
                aria-label={`${recsCount} Freshness Recommendations available`}
              >
                <span className="font-semibold">{recsCount} Rec{recsCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Goal Impact Analysis Trigger Button */}
          {onOpenGoalImpactModal && (
            <button
              onClick={onOpenGoalImpactModal}
              className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Analyze Goal Impact"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analyze Goal Impact
            </button>
          )}

          {/* Overall Completion Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="w-32 bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-900">{progressPercent}%</span>
              <span className="text-xs text-slate-500 block">
                {completedCount}/{nodeCount} topics
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
