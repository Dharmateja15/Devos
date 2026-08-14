'use client';

import React, { useState } from 'react';
import { importRoadmap, RoadmapDto } from '../../lib/api/roadmap-client';

interface ImportRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedRoadmap: RoadmapDto) => void;
  accessToken: string | null;
}

export function ImportRoadmapModal({
  isOpen,
  onClose,
  onSuccess,
  accessToken,
}: ImportRoadmapModalProps) {
  const [input, setInput] = useState('');
  const [sourceType, setSourceType] = useState<'ROADMAP_SH' | 'JSON' | 'CSV' | 'MARKDOWN'>('ROADMAP_SH');
  const [sourceName, setSourceName] = useState('');
  const [createNewRoadmap, setCreateNewRoadmap] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError('Please provide roadmap URL or content.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await importRoadmap(
        {
          input: input.trim(),
          sourceType,
          sourceName: sourceName.trim() || undefined,
          createNewRoadmap,
        },
        accessToken
      );
      setIsLoading(false);
      onSuccess(res);
      onClose();
      setInput('');
      setSourceName('');
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Import failed. Check format or backend connectivity.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-xl font-bold text-slate-900">Import Roadmap</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Source Format / Type
            </label>
            <select
              value={sourceType}
              onChange={(e: any) => setSourceType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ROADMAP_SH">roadmap.sh URL</option>
              <option value="MARKDOWN">Markdown Document</option>
              <option value="JSON">Raw JSON</option>
              <option value="CSV">CSV Data</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Roadmap Name / Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Backend Developer Roadmap"
              value={sourceName}
              onChange={e => setSourceName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Roadmap URL or Content Input
            </label>
            <textarea
              rows={4}
              placeholder={
                sourceType === 'ROADMAP_SH'
                  ? 'https://roadmap.sh/backend'
                  : 'Paste Markdown, JSON, or CSV structure here...'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createNew"
              checked={createNewRoadmap}
              onChange={e => setCreateNewRoadmap(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="createNew" className="text-xs text-slate-600">
              Force creation of a new roadmap (disable auto-matching existing roadmap by title/url)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Importing...
                </>
              ) : (
                'Import Roadmap'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
