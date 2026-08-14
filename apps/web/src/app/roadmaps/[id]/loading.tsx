import React from 'react';

export default function LoadingRoadmapWorkspace() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-pulse">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="h-8 bg-slate-100 border-b border-slate-200" />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="h-[600px] bg-slate-200 rounded-2xl" />
      </main>
    </div>
  );
}
