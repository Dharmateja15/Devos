'use client';

import React from 'react';
import Link from 'next/link';
import { RoadmapDto } from '../../lib/api/roadmap-client';

interface RoadmapCardProps {
  roadmap: RoadmapDto;
}

export function RoadmapCard({ roadmap }: RoadmapCardProps) {
  const latestSnapshot = roadmap.snapshots?.[0];
  const nodeCount = latestSnapshot?._count?.nodes ?? latestSnapshot?.nodes?.length ?? 0;

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    PAUSED: 'bg-amber-100 text-amber-800 border-amber-300',
    COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const priorityColors: Record<string, string> = {
    PRIMARY: 'bg-purple-100 text-purple-800 border-purple-300',
    SECONDARY: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              statusColors[roadmap.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {roadmap.status}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${
              priorityColors[roadmap.priority] || 'bg-gray-50 text-gray-600'
            }`}
          >
            {roadmap.priority}
          </span>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1">
          {roadmap.title}
        </h3>

        <div className="text-sm text-slate-500 space-y-1 mb-4">
          <p className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700">{nodeCount}</span> roadmap topics
          </p>
          <p className="text-xs text-slate-400">
            Updated {new Date(roadmap.updatedAt || roadmap.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Link
        href={`/roadmaps/${roadmap.id}`}
        className="w-full inline-flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
      >
        Open Roadmap Workspace
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>
    </div>
  );
}
