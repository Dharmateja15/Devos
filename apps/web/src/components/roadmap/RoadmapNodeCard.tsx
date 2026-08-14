import React from 'react';
import { RoadmapNodeDto } from '../../lib/api/roadmap-client';
import { NodeMappedIntelligence } from '../../lib/utils/intelligence-mapper';

interface RoadmapNodeCardProps {
  node: RoadmapNodeDto;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  mappedIntelligence?: NodeMappedIntelligence;
  isImpactAffected?: boolean;
}

export function RoadmapNodeCard({
  node,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggleExpand,
  mappedIntelligence,
  isImpactAffected = false,
}: RoadmapNodeCardProps) {
  const mapping = node.mappings?.[0];
  const isKnown = mapping?.mappingStatus === 'KNOWN_UNVERIFIED' || mapping?.mappingStatus === 'COMPLETED' || mapping?.userConfirmation;

  // Type-based styling
  const getNodeTypeBadge = () => {
    switch (node.nodeType) {
      case 'TOPIC':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">TOPIC</span>;
      case 'SUBTOPIC':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">SUBTOPIC</span>;
      case 'RESOURCE':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">RESOURCE</span>;
      case 'ASSESSMENT':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">ASSESSMENT</span>;
      default:
        return null;
    }
  };

  // Extract 5B Overlay Indicators
  const freshness = mappedIntelligence?.freshness;
  const conflict = mappedIntelligence?.conflict;
  const projectGap = mappedIntelligence?.projectGap;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-label={`${node.title}, ${node.nodeType}${isKnown ? ', Completed' : ''}${freshness?.freshnessState ? `, Freshness: ${freshness.freshnessState}` : ''}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`
        relative group rounded-xl p-3.5 border text-left transition-all duration-200 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${isImpactAffected ? 'ring-2 ring-purple-500 bg-purple-50/50 border-purple-300' : ''}
        ${isSelected ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {getNodeTypeBadge()}
          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
            {node.title}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Completion check icon */}
          {isKnown && (
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold" title="Completed / Known">
              ✓
            </span>
          )}

          {/* Reserved 5A Extension Slot 1: Freshness Overlay */}
          {freshness?.freshnessState && freshness.freshnessState !== 'UNKNOWN_FRESHNESS' && (
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block ${
                freshness.freshnessState === 'FRESH'
                  ? 'bg-emerald-500'
                  : freshness.freshnessState === 'AGING'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              title={`Freshness: ${freshness.freshnessState} (${Math.round((freshness.recencyScore || 0) * 100)}%)`}
              aria-label={`Freshness: ${freshness.freshnessState}`}
            />
          )}

          {/* Expand/Collapse Toggle */}
          {hasChildren && (
            <button
              onClick={onToggleExpand}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
              aria-label={isExpanded ? 'Collapse branch' : 'Expand branch'}
            >
              <svg
                className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Reserved 5A Extension Slots 2 & 3: Conflict & Project Gap Overlay Row */}
      {(conflict || projectGap || (freshness?.freshnessState === 'STALE')) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px]">
          {/* Freshness Stale Tag */}
          {freshness?.freshnessState === 'STALE' && (
            <span className="inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              Stale
            </span>
          )}

          {/* Reserved Slot 2: Conflict Overlay Badge */}
          {conflict && (
            <span
              className="inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
              title={`Conflict: ${conflict.whyReason}`}
            >
              <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Conflict Alert
            </span>
          )}

          {/* Reserved Slot 3: Project Gap Overlay Badge */}
          {projectGap && (
            <span
              className={`inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded border ${
                projectGap.gapStatus === 'SATISFIED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : projectGap.gapStatus === 'EVIDENCE_FOUND'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : projectGap.gapStatus === 'IN_PROGRESS'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title={`Project Gap: ${projectGap.gapStatus}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Project {projectGap.gapStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
