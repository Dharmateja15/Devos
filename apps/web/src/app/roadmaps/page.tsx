'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchRoadmaps, RoadmapDto } from '../../lib/api/roadmap-client';
import { RoadmapList } from '../../components/roadmap/RoadmapList';
import { ImportRoadmapModal } from '../../components/roadmap/ImportRoadmapModal';
import Link from 'next/link';

export default function RoadmapsPage() {
  const { accessToken } = useAuth();
  const [roadmaps, setRoadmaps] = useState<RoadmapDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadRoadmaps = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRoadmaps(accessToken);
      setRoadmaps(data);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to load roadmaps.');
    }
  };

  useEffect(() => {
    loadRoadmaps();
  }, [accessToken]);

  const handleImportSuccess = (newRoadmap: RoadmapDto) => {
    setRoadmaps(prev => [newRoadmap, ...prev.filter(r => r.id !== newRoadmap.id)]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              ← Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-bold text-slate-900">Learning Roadmaps</h1>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import Roadmap
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">My Learning Roadmaps</h2>
          <p className="text-slate-600 text-sm max-w-2xl">
            Import and explore your technical roadmaps. Visualize node hierarchies, resource links, and track your topic progress.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadRoadmaps} className="underline font-semibold hover:text-red-900">
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-slate-200 rounded-xl" />
            ))}
          </div>
        ) : (
          <RoadmapList
            roadmaps={roadmaps}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}
      </main>

      {/* Import Modal */}
      <ImportRoadmapModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        accessToken={accessToken}
      />
    </div>
  );
}
