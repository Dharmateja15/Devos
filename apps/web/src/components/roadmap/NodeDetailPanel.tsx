'use client';

import React, { useState } from 'react';
import { RoadmapNodeDto, selfReportMapping } from '../../lib/api/roadmap-client';
import { PaceAdaptationDto } from '../../lib/api/intelligence-client';
import { NodeMappedIntelligence } from '../../lib/utils/intelligence-mapper';
import { useIntelligence } from '../../context/IntelligenceContext';
import { ProjectSubmissionModal } from './ProjectSubmissionModal';

interface NodeDetailPanelProps {
  node: RoadmapNodeDto | null;
  parentNode: RoadmapNodeDto | null;
  childrenNodes: RoadmapNodeDto[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelfReportSuccess: (mappingId: string) => void;
  accessToken: string | null;
  mappedIntelligence?: NodeMappedIntelligence;
  paceAdaptation?: PaceAdaptationDto | null;
}

export function NodeDetailPanel({
  node,
  parentNode,
  childrenNodes,
  isOpen,
  onClose,
  onSelectNode,
  onSelfReportSuccess,
  accessToken,
  mappedIntelligence,
  paceAdaptation: propsPaceAdaptation,
}: NodeDetailPanelProps) {
  const { paceAdaptation: contextPaceAdaptation } = useIntelligence();
  const [isSubmittingSelfReport, setIsSubmittingSelfReport] = useState(false);
  const [selfReportError, setSelfReportError] = useState<string | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  if (!isOpen || !node) return null;

  const mapping = node.mappings?.[0];
  const isKnown = mapping?.mappingStatus === 'KNOWN_UNVERIFIED' || mapping?.mappingStatus === 'COMPLETED' || mapping?.userConfirmation;

  // Extract 4 Approved 5B.5 Node & Roadmap Intelligence Surfaces
  const freshness = mappedIntelligence?.freshness;
  const conflict = mappedIntelligence?.conflict;
  const projectGap = mappedIntelligence?.projectGap;
  const paceAdaptation = propsPaceAdaptation !== undefined ? propsPaceAdaptation : contextPaceAdaptation;

  const handleSelfReport = async () => {
    if (!mapping?.id) return;
    setIsSubmittingSelfReport(true);
    setSelfReportError(null);

    try {
      await selfReportMapping(mapping.id, accessToken);
      setIsSubmittingSelfReport(false);
      onSelfReportSuccess(mapping.id);
    } catch (err: any) {
      setIsSubmittingSelfReport(false);
      setSelfReportError(err.message || 'Failed to submit self-report status.');
    }
  };

  const handleEvidenceSuccess = () => {
    // Re-trigger refresh callback to re-evaluate Phase 4 project gap intelligence
    onSelfReportSuccess(mapping?.id || node.id);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {node.nodeType}
            </span>
            {isKnown && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                ✓ Mastered / Known
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900">{node.title}</h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          aria-label="Close detail panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Description */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {node.description || 'No detailed description provided for this topic node.'}
          </p>
        </div>

        {/* Phase 4 Canonical Learner State Display */}
        {freshness?.learnerState && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Canonical Learner State</h4>
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
              <span className="text-xs text-indigo-900 font-medium">Phase 4 Verified State</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-600 text-white uppercase">
                {freshness.learnerState}
              </span>
            </div>
          </div>
        )}

        {/* Surface 1: Knowledge Freshness & Recency Surface */}
        {freshness?.freshnessState && freshness.freshnessState !== 'UNKNOWN_FRESHNESS' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Knowledge Freshness</h4>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  freshness.freshnessState === 'FRESH'
                    ? 'bg-emerald-100 text-emerald-800'
                    : freshness.freshnessState === 'AGING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {freshness.freshnessState}
              </span>
            </div>

            {freshness.recencyScore !== null && freshness.recencyScore !== undefined && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Recency Score</span>
                  <span className="font-semibold">{Math.round(freshness.recencyScore * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      freshness.recencyScore >= 0.7
                        ? 'bg-emerald-500'
                        : freshness.recencyScore >= 0.35
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(freshness.recencyScore * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {freshness.daysSinceLastDemonstration !== undefined && freshness.daysSinceLastDemonstration !== null && (
              <div className="text-xs text-slate-500">
                <span>Last demonstrated: </span>
                <span className="font-semibold text-slate-700">
                  {freshness.daysSinceLastDemonstration === 0 ? 'Today' : `${freshness.daysSinceLastDemonstration} days ago`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Surface 2: Evidence Conflict Analysis Surface */}
        {conflict && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Evidence Conflict Detected
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">{conflict.whyReason}</p>
            <div className="text-[11px] text-amber-900 space-y-1 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200/80">
              <div><strong>Winning Signal:</strong> {conflict.winningSignal.description}</div>
              <div><strong>Conflicting Signal:</strong> {conflict.conflictingSignal.description}</div>
              <div className="pt-1 font-semibold text-indigo-700">Suggested Advisory Action: {conflict.suggestedAction}</div>
            </div>
          </div>
        )}

        {/* Surface 3: Pace Adaptation Surface (Roadmap Learning Pace Context) */}
        {paceAdaptation && (
          <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Roadmap Learning Pace</h4>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-800">
                {paceAdaptation.paceState}
              </span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">{paceAdaptation.explanation}</p>
            <div className="flex items-center justify-between text-xs text-purple-900 font-medium pt-1 border-t border-purple-200/60">
              <span>Suggested Velocity</span>
              <span className="font-bold">{paceAdaptation.suggestedBatchSize} tasks / week</span>
            </div>
          </div>
        )}

        {/* Surface 4: Project Gap & Evidence Submission Surface */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Gap & Evidence</h4>
            {projectGap && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  projectGap.gapStatus === 'SATISFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : projectGap.gapStatus === 'EVIDENCE_FOUND'
                    ? 'bg-blue-100 text-blue-800'
                    : projectGap.gapStatus === 'IN_PROGRESS'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {projectGap.gapStatus}
              </span>
            )}
          </div>

          {projectGap && <p className="text-xs text-slate-600 leading-relaxed">{projectGap.whyReason}</p>}

          {projectGap?.requiredTechStack && projectGap.requiredTechStack.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Required Tech Stack</span>
              <div className="flex flex-wrap gap-1">
                {projectGap.requiredTechStack.map((tech, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {projectGap?.missingCapabilities && projectGap.missingCapabilities.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Missing Capabilities</span>
              <div className="flex flex-wrap gap-1">
                {projectGap.missingCapabilities.map((cap, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* GitHub Evidence Submission Trigger */}
          <button
            onClick={() => setIsEvidenceModalOpen(true)}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Submit GitHub Evidence
          </button>
        </div>

        {/* Self-Report Action Button */}
        {mapping && !isKnown && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Self-Report Knowledge</h4>
            <p className="text-xs text-slate-500">
              Already familiar with this topic? Mark it as self-reported knowledge.
            </p>
            {selfReportError && <p className="text-xs text-red-600 font-medium">{selfReportError}</p>}
            <button
              onClick={handleSelfReport}
              disabled={isSubmittingSelfReport}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isSubmittingSelfReport ? 'Submitting...' : 'Mark Topic as Known'}
            </button>
          </div>
        )}

        {/* Hierarchy Navigation */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          {parentNode && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Parent Topic</h4>
              <button
                onClick={() => onSelectNode(parentNode.id)}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/50 transition-colors text-sm font-medium text-slate-800 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span>↑ {parentNode.title}</span>
                <span className="text-xs text-slate-400">View Parent</span>
              </button>
            </div>
          )}

          {childrenNodes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Child Subtopics ({childrenNodes.length})
              </h4>
              <div className="space-y-2">
                {childrenNodes.map(child => (
                  <button
                    key={child.id}
                    onClick={() => onSelectNode(child.id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/50 transition-colors text-sm font-medium text-slate-800 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>↓ {child.title}</span>
                    <span className="text-xs text-slate-400">View Topic</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* External Resource Documentation Links */}
        {node.resourceUrls && node.resourceUrls.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">External Resources</h4>
            <ul className="space-y-2">
              {node.resourceUrls.map((url, index) => (
                <li key={index}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline truncate flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                  >
                    <svg className="w-4 h-4 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span className="truncate">{url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* GitHub Evidence Submission Modal */}
      <ProjectSubmissionModal
        nodeTitle={node.title}
        projectId={projectGap?.matchedProjectId || mapping?.projectId || undefined}
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onSuccess={handleEvidenceSuccess}
        accessToken={accessToken}
      />
    </div>
  );
}
