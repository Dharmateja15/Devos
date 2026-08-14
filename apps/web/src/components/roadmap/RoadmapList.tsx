'use client';

import React from 'react';
import { RoadmapDto } from '../../lib/api/roadmap-client';
import { RoadmapCard } from './RoadmapCard';

interface RoadmapListProps {
  roadmaps: RoadmapDto[];
  onOpenImportModal: () => void;
}

export function RoadmapList({ roadmaps, onOpenImportModal }: RoadmapListProps) {
  if (roadmaps.length === 0) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Roadmaps Found</h3>
        <p className="text-sm text-slate-500 mb-6">
          Import a learning roadmap (e.g. from roadmap.sh, Markdown, or JSON) to visualize your skill structure.
        </p>
        <button
          onClick={onOpenImportModal}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Import Your First Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {roadmaps.map(roadmap => (
        <RoadmapCard key={roadmap.id} roadmap={roadmap} />
      ))}
    </div>
  );
}
