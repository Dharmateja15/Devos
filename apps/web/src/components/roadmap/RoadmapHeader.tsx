import React from 'react';
import Link from 'next/link';
import { RoadmapDto } from '../../lib/api/roadmap-client';
import { PaceAdaptationDto, CapabilityFreshnessResponseDto, ConflictAnalysisDto } from '../../lib/api/intelligence-client';

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
  paceAdaptation,
  freshnessSummary,
  conflictsCount = 0,
  onOpenGoalImpactModal,
}: RoadmapHeaderProps) {
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
            <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-6">
          {/* Phase 5B Real-Time Intelligence Summary Pills */}
          <div className="hidden lg:flex items-center gap-3 text-xs border-r border-slate-200 pr-6">
            {freshnessSummary && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-700">
                  Freshness: {freshnessSummary.freshCount} Fresh
                  {freshnessSummary.staleCount > 0 && (
                    <span className="text-red-600 font-semibold ml-1">· {freshnessSummary.staleCount} Stale</span>
                  )}
                </span>
              </div>
            )}

            {conflictsCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-amber-800">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">{conflictsCount} Conflict Alert</span>
              </div>
            )}

            {paceAdaptation && (
              <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-800">
                <span className="font-semibold">Pace: {paceAdaptation.paceState}</span>
                <span className="text-purple-600">({paceAdaptation.suggestedBatchSize} tasks/wk)</span>
              </div>
            )}
          </div>

          {/* Goal Impact Analysis Trigger Button */}
          {onOpenGoalImpactModal && (
            <button
              onClick={onOpenGoalImpactModal}
              className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analyze Goal Impact
            </button>
          )}

          {/* Overall Completion Progress */}
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
