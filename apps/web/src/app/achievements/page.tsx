'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { getAchievementsCatalogueApi, AchievementCatalogueItemDto } from '../../lib/api';

export type FilterTab = 'ALL' | 'EARNED' | 'LOCKED';

export type IconKind = 'flag' | 'flame' | 'trophy' | 'target' | 'milestone' | 'rocket' | 'evidence' | 'star';

/**
 * Returns canonical semantic icon identifier for an achievement definition.
 */
export function getAchievementIconName(icon: string | null, code: string): IconKind {
  if (icon && icon.trim()) {
    const ic = icon.toLowerCase().trim();
    if (ic === 'flag' || ic === 'first') return 'flag';
    if (ic === 'fire' || ic === 'flame' || ic === 'streak') return 'flame';
    if (ic === 'trophy' || ic === 'award') return 'trophy';
    if (ic === 'target' || ic === 'task') return 'target';
    if (ic === 'milestone') return 'milestone';
    if (ic === 'journey' || ic === 'rocket') return 'rocket';
    if (ic === 'evidence' || ic === 'document' || ic === 'certificate') return 'evidence';
  }

  const c = code.toLowerCase();
  if (c.includes('streak')) return 'flame';
  if (c.includes('task') || c.includes('step')) return 'target';
  if (c.includes('milestone')) return 'milestone';
  if (c.includes('journey')) return 'rocket';
  if (c.includes('evidence')) return 'evidence';

  return 'star';
}

export function formatDate(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

/* ==========================================
 * Vector SVG Icon Components (No Emoji)
 * ========================================== */

export function AchievementSvgIcon({ kind, className = 'w-6 h-6' }: { kind: IconKind; className?: string }) {
  switch (kind) {
    case 'flag':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm0 0h18" />
        </svg>
      );
    case 'flame':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9.879z" />
        </svg>
      );
    case 'trophy':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6zM5 4h14v3H5V4z" />
        </svg>
      );
    case 'target':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="1" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
        </svg>
      );
    case 'milestone':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    case 'rocket':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-.707-1.707l2.12-2.12a1 1 0 01.707-.293h1.586l4.243-4.243a1 1 0 01.707-.293h2.828a1 1 0 01.707 1.707l-8.485 8.485z" />
        </svg>
      );
    case 'evidence':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'star':
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
  }
}

export function LockSvgIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export function CheckSvgIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ==========================================
 * Main Achievement Showcase Component
 * ========================================== */

export default function AchievementsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [achievements, setAchievements] = useState<AchievementCatalogueItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementCatalogueItemDto | null>(null);

  const fetchCatalogue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAchievementsCatalogueApi(accessToken);
      setAchievements(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load achievements. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading) {
      fetchCatalogue();
    }
  }, [authLoading, fetchCatalogue]);

  const earnedCount = useMemo(() => achievements.filter(a => a.earned).length, [achievements]);
  const totalCount = achievements.length;

  const filteredAchievements = useMemo(() => {
    if (filter === 'EARNED') return achievements.filter(a => a.earned);
    if (filter === 'LOCKED') return achievements.filter(a => !a.earned);
    return achievements;
  }, [achievements, filter]);

  return (
    <div className="min-h-screen bg-[#0D0F12] text-[#E6EDF3] p-4 md:p-8 font-sans selection:bg-purple-600 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="text-xs text-[#8B949E]">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/dashboard" className="hover:text-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
                Dashboard
              </Link>
            </li>
            <li>/</li>
            <li className="text-[#E6EDF3] font-medium" aria-current="page">Achievements</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-800/80 text-purple-400">
                <AchievementSvgIcon kind="trophy" className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Achievements
              </h1>
              {!isLoading && !error && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/80 font-mono">
                  {earnedCount} earned · {totalCount} total
                </span>
              )}
            </div>
            <p className="text-xs text-[#8B949E] mt-1">
              Milestones and proof-of-work badges unlocked through continuous developer learning and activity.
            </p>
          </div>
          <button
            onClick={fetchCatalogue}
            disabled={isLoading}
            className="self-start sm:self-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1C2128] hover:bg-[#30363D] text-[#E6EDF3] border border-[#30363D] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </header>

        {/* Filter Controls */}
        {!isLoading && !error && achievements.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-[#161B22] p-1 rounded-xl border border-[#30363D]">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  filter === 'ALL'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128]'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilter('EARNED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  filter === 'EARNED'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128]'
                }`}
              >
                Earned ({earnedCount})
              </button>
              <button
                onClick={() => setFilter('LOCKED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  filter === 'LOCKED'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128]'
                }`}
              >
                Locked ({totalCount - earnedCount})
              </button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading && (
          <div className="p-12 text-center bg-[#161B22] rounded-2xl border border-[#30363D] space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-[#8B949E]" aria-live="polite">Loading Achievement Catalogue...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !isLoading && (
          <div className="p-6 bg-red-950/40 border border-red-800/80 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-red-200">Unable to load achievements</h2>
            <p className="text-xs text-red-300">{error}</p>
            <button
              onClick={fetchCatalogue}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Retry Request
            </button>
          </div>
        )}

        {/* SYSTEM EMPTY STATE */}
        {!isLoading && !error && achievements.length === 0 && (
          <div className="p-12 text-center bg-[#161B22] rounded-2xl border border-[#30363D] space-y-2">
            <p className="text-sm font-semibold text-[#E6EDF3]">No active system achievements found</p>
            <p className="text-xs text-[#8B949E] max-w-md mx-auto">
              Achievement definitions have not been populated in the system catalogue yet.
            </p>
          </div>
        )}

        {/* FILTER EMPTY STATE */}
        {!isLoading && !error && achievements.length > 0 && filteredAchievements.length === 0 && (
          <div className="p-10 text-center bg-[#161B22] rounded-2xl border border-[#30363D] space-y-2">
            <p className="text-sm font-semibold text-[#E6EDF3]">
              {filter === 'EARNED' ? 'No earned achievements yet' : 'No locked achievements remaining'}
            </p>
            <p className="text-xs text-[#8B949E]">
              {filter === 'EARNED'
                ? 'Complete learning tasks, milestones, and evidence verification to earn your first achievement badge.'
                : 'Congratulations! You have unlocked all active achievements in the catalogue.'}
            </p>
            <button
              onClick={() => setFilter('ALL')}
              className="mt-2 text-xs font-semibold text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
            >
              Show All Achievements
            </button>
          </div>
        )}

        {/* ACHIEVEMENT GRID */}
        {!isLoading && !error && filteredAchievements.length > 0 && (
          <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map((item) => {
              const iconKind = getAchievementIconName(item.icon, item.code);
              const formattedEarnedDate = formatDate(item.earnedAt);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedAchievement(item)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAchievement(item);
                    }
                  }}
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 flex flex-col justify-between space-y-4 ${
                    item.earned
                      ? 'bg-[#161B22] border-purple-800/60 hover:border-purple-500 shadow-lg shadow-purple-950/20'
                      : 'bg-[#161B22]/60 border-[#30363D] opacity-75 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon & Status Pill */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner ${
                          item.earned
                            ? 'bg-purple-950/80 border border-purple-700/60 text-purple-300'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]'
                        }`}
                        aria-hidden="true"
                      >
                        <AchievementSvgIcon kind={iconKind} className="w-5 h-5" />
                      </div>

                      {item.earned ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">
                          <CheckSvgIcon />
                          Earned
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C2128] text-[#8B949E] border border-[#30363D] flex items-center gap-1">
                          <LockSvgIcon />
                          Locked
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className={`text-base font-bold ${item.earned ? 'text-white' : 'text-[#E6EDF3]'}`}>
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#8B949E] mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Footer Details */}
                  <div className="pt-3 border-t border-[#30363D]/80 flex items-center justify-between text-[11px]">
                    {item.category ? (
                      <span className="font-medium text-[#8B949E] uppercase tracking-wider text-[10px]">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-[#8B949E]">Achievement</span>
                    )}

                    <div className="flex items-center gap-2">
                      {item.xpReward > 0 && (
                        <span className="font-mono font-bold text-purple-400">
                          +{item.xpReward} XP
                        </span>
                      )}
                      {item.earned && formattedEarnedDate && (
                        <span className="text-[#8B949E] font-mono">
                          • {formattedEarnedDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {/* DETAIL MODAL OVERLAY */}
        {selectedAchievement && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievement-modal-title"
          >
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedAchievement.earned
                        ? 'bg-purple-950/80 border border-purple-700/60 text-purple-300'
                        : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]'
                    }`}
                  >
                    <AchievementSvgIcon kind={getAchievementIconName(selectedAchievement.icon, selectedAchievement.code)} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 id="achievement-modal-title" className="text-lg font-bold text-white">
                      {selectedAchievement.name}
                    </h3>
                    {selectedAchievement.category && (
                      <span className="text-[10px] uppercase font-bold text-purple-400">
                        {selectedAchievement.category}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="text-[#8B949E] hover:text-white p-1 rounded-lg hover:bg-[#1C2128] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#E6EDF3] leading-relaxed">
                  {selectedAchievement.description}
                </p>

                <div className="p-3 bg-[#1C2128] rounded-xl border border-[#30363D] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8B949E]">Status:</span>
                    {selectedAchievement.earned ? (
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckSvgIcon /> Earned
                      </span>
                    ) : (
                      <span className="font-bold text-[#8B949E] flex items-center gap-1">
                        <LockSvgIcon /> Locked
                      </span>
                    )}
                  </div>
                  {selectedAchievement.earned && selectedAchievement.earnedAt && (
                    <div className="flex justify-between">
                      <span className="text-[#8B949E]">Earned On:</span>
                      <span className="font-mono text-[#E6EDF3]">
                        {formatDate(selectedAchievement.earnedAt)}
                      </span>
                    </div>
                  )}
                  {selectedAchievement.xpReward > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#8B949E]">XP Reward:</span>
                      <span className="font-mono font-bold text-purple-400">
                        +{selectedAchievement.xpReward} XP
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Close Detail
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
