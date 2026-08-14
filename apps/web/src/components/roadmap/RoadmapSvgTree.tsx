'use client';

import React from 'react';
import { TreeNode } from '../../lib/utils/roadmap-tree-transformer';
import { RoadmapNodeCard } from './RoadmapNodeCard';
import { NodeMappedIntelligence } from '../../lib/utils/intelligence-mapper';

interface RoadmapSvgTreeProps {
  treeRoots: TreeNode[];
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  onSelectNode: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  nodeIntelligenceMap?: Map<string, NodeMappedIntelligence>;
  affectedNodeIds?: string[];
}

export function RoadmapSvgTree({
  treeRoots,
  selectedNodeId,
  expandedNodeIds,
  onSelectNode,
  onToggleExpand,
  nodeIntelligenceMap,
  affectedNodeIds = [],
}: RoadmapSvgTreeProps) {
  // Helper to render tree branch recursively
  const renderBranch = (nodes: TreeNode[]) => {
    return (
      <div className="flex flex-col gap-6 items-center">
        {nodes.map(treeNode => {
          const isExpanded = expandedNodeIds.has(treeNode.node.id);
          const hasChildren = treeNode.children.length > 0;
          const isSelected = selectedNodeId === treeNode.node.id;
          const mappedIntelligence = nodeIntelligenceMap?.get(treeNode.node.id);
          const isImpactAffected = affectedNodeIds.includes(treeNode.node.id);

          return (
            <div key={treeNode.node.id} className="flex flex-col items-center">
              {/* Node Card */}
              <RoadmapNodeCard
                node={treeNode.node}
                isSelected={isSelected}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                onSelect={() => onSelectNode(treeNode.node.id)}
                onToggleExpand={(e) => {
                  e.stopPropagation();
                  onToggleExpand(treeNode.node.id);
                }}
                mappedIntelligence={mappedIntelligence}
                isImpactAffected={isImpactAffected}
              />

              {/* Children Branch with SVG Connector Line */}
              {hasChildren && isExpanded && (
                <div className="flex flex-col items-center w-full mt-4">
                  {/* Vertical Connector Line */}
                  <div className="w-0.5 h-6 bg-slate-300" />

                  {/* Horizontal Branch Bar if > 1 child */}
                  {treeNode.children.length > 1 && (
                    <div className="w-4/5 border-t-2 border-slate-300 mb-4" />
                  )}

                  {/* Sub-Children Level */}
                  <div className="flex flex-wrap justify-center gap-8 items-start">
                    {renderBranch(treeNode.children)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex justify-center py-8">
      {renderBranch(treeRoots)}
    </div>
  );
}
