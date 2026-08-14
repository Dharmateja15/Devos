'use client';

import React, { useState, useMemo } from 'react';
import { RoadmapNodeDto } from '../../lib/api/roadmap-client';
import { transformNodesToTree } from '../../lib/utils/roadmap-tree-transformer';
import { RoadmapSvgTree } from './RoadmapSvgTree';
import { RoadmapNodeCard } from './RoadmapNodeCard';
import { NodeMappedIntelligence } from '../../lib/utils/intelligence-mapper';

interface RoadmapCanvasProps {
  flatNodes: RoadmapNodeDto[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  nodeIntelligenceMap?: Map<string, NodeMappedIntelligence>;
  affectedNodeIds?: string[];
}

export function RoadmapCanvas({
  flatNodes,
  selectedNodeId,
  onSelectNode,
  nodeIntelligenceMap,
  affectedNodeIds = [],
}: RoadmapCanvasProps) {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [viewMode, setViewMode] = useState<'CANVAS' | 'MOBILE_LIST'>('CANVAS');

  // Derive tree hierarchy from flatNodes
  const treeRoots = useMemo(() => transformNodesToTree(flatNodes), [flatNodes]);

  // Manage local UI state for expanded nodes (all root nodes expanded by default)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const root of treeRoots) {
      initial.add(root.node.id);
      for (const child of root.children) {
        initial.add(child.node.id);
      }
    }
    return initial;
  });

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(2.0, Number((prev + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.5, Number((prev - 0.15).toFixed(2))));
  const handleResetZoom = () => setZoomLevel(1.0);

  const handleExpandAll = () => {
    const all = new Set<string>();
    for (const n of flatNodes) {
      all.add(n.id);
    }
    setExpandedNodeIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  if (flatNodes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
        No nodes found in this roadmap snapshot.
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[600px] bg-slate-900/5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between">
      {/* Canvas Toolbar Controls */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Zoom Out (-)"
            >
              –
            </button>
            <span className="px-3 py-1.5 text-xs font-mono text-slate-600 border-x border-slate-200">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.0}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-l border-slate-200 transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* View Mode Toggle (Mobile / Tablet Responsive Switch) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('CANVAS')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'CANVAS'
                ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Canvas View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('MOBILE_LIST')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'MOBILE_LIST'
                ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tree List View
          </button>
        </div>
      </div>

      {/* Main Interactive Workspace Area */}
      <div className="relative flex-1 overflow-auto p-6 flex justify-center items-start">
        {viewMode === 'CANVAS' ? (
          <div
            className="transition-transform duration-150 origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <RoadmapSvgTree
              treeRoots={treeRoots}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onSelectNode={id => onSelectNode(id)}
              onToggleExpand={handleToggleExpand}
              nodeIntelligenceMap={nodeIntelligenceMap}
              affectedNodeIds={affectedNodeIds}
            />
          </div>
        ) : (
          /* Mobile / Tablet Accordion Tree List Fallback */
          <div className="w-full max-w-2xl space-y-4">
            {flatNodes.map(node => (
              <RoadmapNodeCard
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isExpanded={expandedNodeIds.has(node.id)}
                hasChildren={flatNodes.some(n => n.parentNodeId === node.id)}
                onSelect={() => onSelectNode(node.id)}
                onToggleExpand={(e) => {
                  e.stopPropagation();
                  handleToggleExpand(node.id);
                }}
                mappedIntelligence={nodeIntelligenceMap?.get(node.id)}
                isImpactAffected={affectedNodeIds.includes(node.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Canvas Footer Hint */}
      <div className="p-2 bg-white/70 backdrop-blur-sm border-t border-slate-200 text-center text-[11px] text-slate-400">
        Click any topic node to inspect details, resource links, and real-time intelligence overlays.
      </div>
    </div>
  );
}
