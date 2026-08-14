import React from 'react';

export default function LoadingRoadmaps() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
