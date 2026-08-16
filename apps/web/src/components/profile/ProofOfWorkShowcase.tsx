import React from 'react';
import { PublicProfileEvidenceDto } from '../../lib/api';
import { CheckSvgIcon } from '../../app/achievements/page';

interface ProofOfWorkShowcaseProps {
  items: PublicProfileEvidenceDto[];
}

export function EvidenceTypeIcon({ type, className = 'w-5 h-5' }: { type: string; className?: string }) {
  const t = (type || '').toUpperCase().trim();
  switch (t) {
    case 'GITHUB_REPO':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'GITHUB_COMMIT':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'PROJECT_SUBMISSION':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'CERTIFICATE':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

export function formatShortSha(sha: string | null): string | null {
  if (!sha || typeof sha !== 'string') return null;
  const clean = sha.trim();
  if (!clean) return null;
  return clean.slice(0, 7);
}

export function formatEvidenceTypeLabel(type: string): string {
  if (!type || typeof type !== 'string') return 'Evidence';
  const clean = type.replace(/^GITHUB_/, '').replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export default function ProofOfWorkShowcase({ items }: ProofOfWorkShowcaseProps) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <EvidenceTypeIcon type="DEFAULT" className="w-5 h-5 text-purple-400" />
          Verified Proof-of-Work ({safeItems.length})
        </h2>
        <span className="text-xs font-mono text-[#8B949E]">Authentic Evidence Showcase</span>
      </div>

      {/* Empty State */}
      {safeItems.length === 0 ? (
        <div className="p-8 text-center bg-[#1C2128] rounded-xl border border-[#30363D]">
          <p className="text-xs font-medium text-[#8B949E]">No verified proof-of-work published yet.</p>
        </div>
      ) : (
        /* Responsive Grid: 1 Column on Mobile, 2 Columns on Desktop */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {safeItems.map((ev) => {
            const shortSha = formatShortSha(ev.githubSha);
            const typeLabel = formatEvidenceTypeLabel(ev.evidenceType);

            return (
              <div
                key={ev.id}
                className="p-4 bg-[#1C2128] rounded-xl border border-[#30363D] hover:border-purple-600/50 transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  {/* Top Row: Type Icon, Verification Pill, Type Label */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/80">
                        <EvidenceTypeIcon type={ev.evidenceType} className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono text-[#8B949E] uppercase tracking-wider">
                        {typeLabel}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1">
                      <CheckSvgIcon /> Verified
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-white break-words leading-snug">
                    {ev.title || 'Verified Evidence'}
                  </h3>

                  {/* GitHub Metadata */}
                  {(ev.githubRepo || shortSha) && (
                    <div className="p-2 bg-[#161B22] rounded-lg border border-[#30363D]/80 text-[11px] font-mono space-y-1">
                      {ev.githubRepo && (
                        <div className="text-purple-300 truncate">
                          <span className="text-[#8B949E]">Repo: </span>
                          {ev.githubRepo}
                        </div>
                      )}
                      {shortSha && (
                        <div className="text-[#8B949E]">
                          <span>Commit: </span>
                          <code className="text-emerald-300 font-bold bg-slate-900/60 px-1 py-0.5 rounded">
                            {shortSha}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* External Link Button */}
                {ev.url && typeof ev.url === 'string' && ev.url.trim() && (
                  <div className="pt-2 border-t border-[#30363D]/60 flex justify-end">
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 inline-flex items-center gap-1.5"
                      aria-label={`Open external evidence URL for ${ev.title || ev.githubRepo || 'evidence'}`}
                    >
                      <span>View Evidence</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
