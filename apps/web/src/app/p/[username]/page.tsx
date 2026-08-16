import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getPublicProfileApi,
  getPublicActivityApi,
  PublicProfileResponseDto,
  PublicProfileIdentityDto,
  PublicProfileGamificationDto,
  PublicProfileJourneyDto,
  PublicProfileEvidenceDto,
} from '../../../lib/api';
import ActivityHeatmap from '../../../components/profile/ActivityHeatmap';
import ProofOfWorkShowcase from '../../../components/profile/ProofOfWorkShowcase';
import {
  AchievementSvgIcon,
  getAchievementIconName,
  formatDate,
  CheckSvgIcon,
  LockSvgIcon,
} from '../../achievements/page';


interface PageProps {
  params: Promise<{ username: string }> | { username: string };
}

/* ==========================================
 * Dynamic SEO & OpenGraph Metadata
 * ========================================== */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const profile = await getPublicProfileApi(resolvedParams.username);

  if (!profile) {
    return {
      title: 'Profile Not Found — DevOS',
      description: 'The requested public profile does not exist or is private.',
    };
  }

  const { identity } = profile;
  const title = `${identity.displayName} (@${identity.username}) — DevOS Developer Profile`;
  const description =
    identity.headline ||
    identity.bio ||
    `Verified developer profile, XP achievements, and public proof-of-work for ${identity.displayName} on DevOS.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: identity.avatarUrl ? [{ url: identity.avatarUrl }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

/* ==========================================
 * Helper Presentation Components
 * ========================================== */

function getInitials(name: string): string {
  if (!name || !name.trim()) return 'DEV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SocialIcon({ platform, className = 'w-4 h-4' }: { platform: string; className?: string }) {
  const p = platform.toLowerCase();
  if (p.includes('github')) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (p.includes('twitter') || p.includes('x')) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (p.includes('linkedin')) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.74a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

/* ==========================================
 * Main Public Developer Profile Page
 * ========================================== */
export default async function PublicProfilePage({ params }: PageProps) {
  const resolvedParams = await params;

  const [profile, activity] = await Promise.all([
    getPublicProfileApi(resolvedParams.username),
    getPublicActivityApi(resolvedParams.username),
  ]);

  if (!profile) {
    notFound();
  }

  const { identity, gamification, journeys, proofOfWork } = profile;


  return (
    <div className="min-h-screen bg-[#0D0F12] text-[#E6EDF3] p-4 md:p-8 font-sans selection:bg-purple-600 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <header className="flex items-center justify-between border-b border-[#30363D] pb-4">
          <Link href="/dashboard" className="text-sm font-bold text-white flex items-center gap-2 hover:text-purple-400 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-white font-mono text-xs">
              DV
            </div>
            DevOS
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8B949E] bg-[#161B22] px-2.5 py-1 rounded-full border border-[#30363D]">
              Verified Developer Profile
            </span>
          </div>
        </header>

        {/* Profile Grid: Left Rail + Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT / PROFILE RAIL */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-5">
              {/* Avatar & Display Identity */}
              <div className="flex flex-col items-center text-center space-y-3">
                {identity.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={identity.avatarUrl}
                    alt={`${identity.displayName}'s avatar`}
                    className="w-24 h-24 rounded-2xl border-2 border-purple-500/60 object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-purple-950/80 border-2 border-purple-600/80 flex items-center justify-center text-purple-300 font-mono text-2xl font-bold shadow-lg">
                    {getInitials(identity.displayName)}
                  </div>
                )}

                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {identity.displayName}
                  </h1>
                  <p className="text-xs font-mono text-purple-400 mt-0.5">
                    @{identity.username}
                  </p>
                </div>

                {identity.headline && (
                  <p className="text-xs font-medium text-[#E6EDF3] leading-relaxed max-w-xs">
                    {identity.headline}
                  </p>
                )}

                {identity.bio && (
                  <p className="text-xs text-[#8B949E] leading-relaxed max-w-xs pt-1 border-t border-[#30363D]/60">
                    {identity.bio}
                  </p>
                )}
              </div>

              {/* Social Links */}
              {identity.socialLinks && Object.keys(identity.socialLinks).length > 0 && (
                <div className="pt-4 border-t border-[#30363D] space-y-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8B949E]">
                    Connect & Socials
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(identity.socialLinks).map(([platform, url]) => {
                      if (!url || typeof url !== 'string') return null;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#1C2128] hover:bg-[#30363D] text-xs font-medium text-[#E6EDF3] border border-[#30363D] transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          aria-label={`Open ${platform} profile`}
                        >
                          <SocialIcon platform={platform} />
                          <span className="capitalize">{platform}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="lg:col-span-8 space-y-8">
            {/* 52-WEEK ACTIVITY HEATMAP */}
            <ActivityHeatmap data={activity} />

            {/* GAMIFICATION SUMMARY CARD */}
            <section className="bg-[#161B22] p-6 rounded-2xl border border-purple-800/40 shadow-xl space-y-4">

              <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/80">
                    <AchievementSvgIcon kind="trophy" className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-white">Gamification & Level Progress</h2>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-800/80">
                  Level {gamification.level} • {gamification.levelTitle}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-[#1C2128] rounded-xl border border-[#30363D] text-center">
                  <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Total XP</span>
                  <span className="text-lg font-mono font-extrabold text-purple-400 mt-1 block">
                    {gamification.totalXp.toLocaleString()} XP
                  </span>
                </div>

                <div className="p-3 bg-[#1C2128] rounded-xl border border-[#30363D] text-center">
                  <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Current Level</span>
                  <span className="text-lg font-extrabold text-white mt-1 block">
                    {gamification.level}
                  </span>
                </div>

                <div className="p-3 bg-[#1C2128] rounded-xl border border-[#30363D] text-center">
                  <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Current Streak</span>
                  <span className="text-lg font-mono font-extrabold text-orange-400 mt-1 block flex items-center justify-center gap-1">
                    <AchievementSvgIcon kind="flame" className="w-4 h-4" />
                    {gamification.currentStreak}d
                  </span>
                </div>

                <div className="p-3 bg-[#1C2128] rounded-xl border border-[#30363D] text-center">
                  <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider block">Longest Streak</span>
                  <span className="text-lg font-mono font-extrabold text-amber-300 mt-1 block">
                    {gamification.longestStreak}d
                  </span>
                </div>
              </div>
            </section>

            {/* EARNED ACHIEVEMENTS SHOWCASE */}
            <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <AchievementSvgIcon kind="target" className="w-5 h-5 text-purple-400" />
                  Earned Achievements ({gamification.earnedAchievements.length})
                </h2>
              </div>

              {gamification.earnedAchievements.length === 0 ? (
                <div className="p-6 text-center bg-[#1C2128] rounded-xl border border-[#30363D]">
                  <p className="text-xs text-[#8B949E]">No achievements earned yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gamification.earnedAchievements.map((item) => {
                    const iconKind = getAchievementIconName(item.icon, item.code);
                    const formattedDate = formatDate(item.earnedAt);

                    return (
                      <div
                        key={item.code}
                        className="p-3.5 bg-[#1C2128] rounded-xl border border-purple-800/40 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-purple-950/80 border border-purple-700/60 text-purple-300 flex items-center justify-center shrink-0">
                          <AchievementSvgIcon kind={iconKind} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-white truncate">{item.name}</h3>
                            <span className="text-[10px] font-mono text-purple-400 font-bold">
                              +{item.xpReward} XP
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B949E] mt-0.5 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                          {formattedDate && (
                            <span className="text-[9px] text-emerald-400 font-mono mt-1 block flex items-center gap-1">
                              <CheckSvgIcon /> Earned on {formattedDate}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PUBLIC JOURNEY SHOWCASE */}
            <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <AchievementSvgIcon kind="milestone" className="w-5 h-5 text-purple-400" />
                  Public Learning Journeys ({journeys.length})
                </h2>
              </div>

              {journeys.length === 0 ? (
                <div className="p-6 text-center bg-[#1C2128] rounded-xl border border-[#30363D]">
                  <p className="text-xs text-[#8B949E]">No public journeys published yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {journeys.map((j) => (
                    <div
                      key={j.id}
                      className="p-4 bg-[#1C2128] rounded-xl border border-[#30363D] space-y-3 hover:border-purple-600/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{j.title}</h3>
                            {j.isFeatured && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                                Featured
                              </span>
                            )}
                          </div>
                          {j.description && (
                            <p className="text-xs text-[#8B949E] mt-1 leading-relaxed">
                              {j.description}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#161B22] text-[#8B949E] border border-[#30363D] uppercase">
                          {j.status}
                        </span>
                      </div>

                      {/* Milestone & Task Progress Counters */}
                      <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#30363D]/60 font-mono">
                        <div>
                          <span className="text-[#8B949E] block text-[10px]">Milestones</span>
                          <span className="font-bold text-white">
                            {j.completedMilestonesCount} / {j.milestonesCount} Completed
                          </span>
                        </div>
                        <div>
                          <span className="text-[#8B949E] block text-[10px]">Tasks Completed</span>
                          <span className="font-bold text-white">
                            {j.completedTasksCount} / {j.tasksCount} Completed
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PROOF OF WORK SHOWCASE */}
            <ProofOfWorkShowcase items={proofOfWork} />

          </main>
        </div>
      </div>
    </div>
  );
}
