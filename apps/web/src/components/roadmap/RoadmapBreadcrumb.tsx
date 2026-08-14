'use client';

import React from 'react';
import { RoadmapNodeDto } from '../../lib/api/roadmap-client';

interface RoadmapBreadcrumbProps {
  roadmapTitle: string;
  selectedNode: RoadmapNodeDto | null;
  nodeMap: Map<string, RoadmapNodeDto>;
  onSelectNode: (nodeId: string) => void;
}

export function RoadmapBreadcrumb({
  roadmapTitle,
  selectedNode,
  nodeMap,
  onSelectNode,
}: RoadmapBreadcrumbProps) {
  const pathNodes: RoadmapNodeDto[] = [];

  if (selectedNode) {
    let curr: RoadmapNodeDto | undefined = selectedNode;
    while (curr) {
      pathNodes.unshift(curr);
      if (curr.parentNodeId && nodeMap.has(curr.parentNodeId)) {
        curr = nodeMap.get(curr.parentNodeId);
      } else {
        break;
      }
    }
  }

  return (
    <nav aria-label="Roadmap path breadcrumb" className="bg-slate-50 border-b border-slate-200 px-6 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto text-slate-600">
        <span className="font-semibold text-slate-800">{roadmapTitle}</span>
        {pathNodes.length > 0 && <span className="text-slate-400">/</span>}
        {pathNodes.map((node, index) => {
          const isLast = index === pathNodes.length - 1;
          return (
            <React.Fragment key={node.id}>
              {index > 0 && <span className="text-slate-400">/</span>}
              <button
                onClick={() => onSelectNode(node.id)}
                className={`truncate max-w-[150px] hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 ${
                  isLast ? 'font-bold text-indigo-600' : 'text-slate-600'
                }`}
              >
                {node.title}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
