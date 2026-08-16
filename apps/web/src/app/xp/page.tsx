'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { getXpSummaryApi, XpSummaryResponseDto, XpLedgerEntryDto } from '../../lib/api';
import { calculateLevelFromXp } from '../../lib/utils/level-calculator';

export function formatSourceType(sourceType: string): string {
  if (!sourceType) return 'Activity Record';
  switch (sourceType.toUpperCase()) {
    case 'TASK_COMPLETION':
      return 'Task Completed';
    case 'MILESTONE_COMPLETION':
      return 'Milestone Completed';
    case 'JOURNEY_COMPLETION':
      return 'Journey Completed';
    case 'EVIDENCE_SUBMISSION':
      return 'Evidence Verified';
    case 'ACHIEVEMENT_UNLOCKED':
      return 'Achievement Unlocked';
    default:
      return sourceType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'Recent';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export default function XpHistoryPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<XpSummaryResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchXpSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await getXpSummaryApi(accessToken);
      setData(summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load XP history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading) {
      fetchXpSummary();
    }
  }, [authLoading, fetchXpSummary]);

  const levelInfo = data ? calculateLevelFromXp(data.totalXp) : null;

  return (
    <div className="min-h-screen bg-[#0D0F12] text-slate-100 p-4 md:p-8 font-sans selection:bg-purple-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/dashboard" className="hover:text-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
                Dashboard
              </Link>
            </li>
            <li>/</li>
            <li className="text-slate-200 font-medium" aria-current="page">XP History</li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-purple-400">⚡</span> XP History & Level Progression
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Audit trail of your verified learning achievements, level thresholds, and XP ledger activity.
            </p>
          </div>
          <button
            onClick={fetchXpSummary}
            disabled={isLoading}
            className="self-start sm:self-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            🔄 Refresh
          </button>
        </header>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="p-12 text-center bg-[#161B22] rounded-2xl border border-slate-800 space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-400" aria-live="polite">Loading XP History...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !isLoading && (
          <div className="p-6 bg-red-950/40 border border-red-800/80 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-red-200">Unable to load XP data</h2>
            <p className="text-xs text-red-300">{error}</p>
            <button
              onClick={fetchXpSummary}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Retry Request
            </button>
          </div>
        )}

        {/* SUCCESS STATE */}
        {!isLoading && !error && data && levelInfo && (
          <main className="space-y-6">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level & XP Hero Card */}
              <section className="md:col-span-2 p-6 bg-[#161B22] border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Current Standing</span>
                    <h2 className="text-2xl font-bold text-white mt-0.5">
                      Level {levelInfo.level} — <span className="text-purple-300">{levelInfo.title}</span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">Total Accumulated</span>
                    <span className="text-2xl font-extrabold font-mono text-purple-400">{data.totalXp.toLocaleString()} XP</span>
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span>Level {levelInfo.level} ({levelInfo.currentLevelXp} XP)</span>
                    {levelInfo.nextLevelXp ? (
                      <span>Next Level ({levelInfo.nextLevelXp} XP)</span>
                    ) : (
                      <span>Max Level Reached</span>
                    )}
                  </div>

                  <div
                    className="w-full bg-slate-900 rounded-full h-3 p-0.5 border border-slate-800"
                    role="progressbar"
                    aria-valuenow={levelInfo.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress to level ${levelInfo.level + 1}`}
                  >
                    <div
                      className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${levelInfo.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{levelInfo.progressPercent}% Progress</span>
                    {levelInfo.nextLevelXp && (
                      <span>{(levelInfo.nextLevelXp - data.totalXp).toLocaleString()} XP to Level {levelInfo.level + 1}</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Period Aggregates Card */}
              <section className="p-6 bg-[#161B22] border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4 shadow-xl">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity Summary</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">This Week</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">+{data.weeklyXp.toLocaleString()} XP</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">This Month</span>
                    <span className="text-lg font-bold font-mono text-purple-400">+{data.monthlyXp.toLocaleString()} XP</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Earn XP by completing journey tasks (+10), materializing milestones (+50), and submitting project evidence (+5).
                </p>
              </section>
            </div>

            {/* Ledger Activity Table */}
            <section className="p-6 bg-[#161B22] border border-slate-800 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📜</span> Recent XP Ledger Entries
                </h2>
                <span className="text-xs font-mono text-slate-400">{data.recentEntries.length} Transactions</span>
              </div>

              {/* EMPTY LEDGER STATE */}
              {data.recentEntries.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
                  <p className="text-sm font-semibold text-slate-300">No XP activity recorded yet</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Complete your first learning task or milestone to begin building your XP ledger history.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">XP Delta</th>
                        <th className="py-3 px-3">Activity / Source</th>
                        <th className="py-3 px-3">Note / Reason</th>
                        <th className="py-3 px-3">Timestamp</th>
                        <th className="py-3 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {data.recentEntries.map((entry: XpLedgerEntryDto) => (
                        <tr key={entry.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* XP Delta Badge */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center font-mono font-bold px-2 py-0.5 rounded ${
                                entry.xpDelta > 0
                                  ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {entry.xpDelta > 0 ? `+${entry.xpDelta}` : entry.xpDelta} XP
                            </span>
                          </td>

                          {/* Source Label */}
                          <td className="py-3 px-3 font-medium text-slate-200 whitespace-nowrap">
                            {formatSourceType(entry.sourceType)}
                          </td>

                          {/* Note / Reason */}
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                            {entry.note || '—'}
                          </td>

                          {/* Timestamp */}
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {formatDate(entry.createdAt)}
                          </td>

                          {/* Balance After */}
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-300 whitespace-nowrap">
                            {entry.balanceAfter.toLocaleString()} XP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
