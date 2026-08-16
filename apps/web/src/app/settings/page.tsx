'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import {
  getSettingsApi,
  updateAccountApi,
  updateProfileApi,
  getGithubAuthorizationUrlApi,
  disconnectGithubApi,
  SettingsResponseDto,
  UpdateAccountPayload,
  UpdateProfilePayload,
} from '../../lib/api';

export function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string' || !urlString.trim()) return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return 'DEV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface SocialItem {
  id: string;
  platform: string;
  url: string;
}

export default function SettingsPage() {
  const { accessToken, loading: authLoading } = useAuth();

  const [serverData, setServerData] = useState<SettingsResponseDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State — Account
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [savingAccount, setSavingAccount] = useState<boolean>(false);
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State — Profile
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [headline, setHeadline] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State — Social Links
  const [socialItems, setSocialItems] = useState<SocialItem[]>([]);
  const [savingSocials, setSavingSocials] = useState<boolean>(false);
  const [socialsFeedback, setSocialsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // GitHub Connection State
  const [connectingGithub, setConnectingGithub] = useState<boolean>(false);
  const [disconnectingGithub, setDisconnectingGithub] = useState<boolean>(false);
  const [githubFeedback, setGithubFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inspect OAuth Callback Query Parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        let msg = 'An error occurred during GitHub authorization.';
        if (errorParam === 'oauth_failed') {
          msg = 'GitHub connection failed. Please try again.';
        } else if (errorParam === 'github_already_linked') {
          msg = 'This GitHub account is already connected to another DevOS account.';
        } else if (errorParam === 'invalid_oauth_params') {
          msg = 'The GitHub authorization request was invalid.';
        }
        setGithubFeedback({ type: 'error', message: msg });

        // Clean query parameter from URL without page reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  // Load Settings on Mount
  useEffect(() => {
    async function loadSettings() {
      if (!accessToken) return;
      try {
        setLoading(true);
        setFetchError(null);
        const res = await getSettingsApi(accessToken);
        setServerData(res);

        // Populate Form Baselines
        setDisplayName(res.account.displayName || '');
        setUsername(res.account.username || '');
        setAvatarUrl(res.account.avatarUrl || '');

        setIsPublic(res.profile.isPublic ?? false);
        setHeadline(res.profile.headline || '');
        setBio(res.profile.bio || '');

        // Populate Social Items
        const items: SocialItem[] = Object.entries(res.profile.socialLinks || {}).map(([platform, url], index) => ({
          id: `soc-${index}-${Date.now()}`,
          platform,
          url,
        }));
        setSocialItems(items);
      } catch (err: any) {
        setFetchError(err.message || 'Failed to load user settings.');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      if (accessToken) {
        loadSettings();
      } else {
        setLoading(false);
      }
    }
  }, [accessToken, authLoading]);

  // Computing Dirty States against Server Baseline
  const isAccountDirty = useMemo(() => {
    if (!serverData) return false;
    return (
      displayName.trim() !== (serverData.account.displayName || '') ||
      username.trim() !== (serverData.account.username || '') ||
      (avatarUrl.trim() || null) !== (serverData.account.avatarUrl || null)
    );
  }, [serverData, displayName, username, avatarUrl]);

  const isProfileDirty = useMemo(() => {
    if (!serverData) return false;
    return (
      isPublic !== (serverData.profile.isPublic ?? false) ||
      headline.trim() !== (serverData.profile.headline || '') ||
      bio.trim() !== (serverData.profile.bio || '')
    );
  }, [serverData, isPublic, headline, bio]);

  const isSocialsDirty = useMemo(() => {
    if (!serverData) return false;
    const currentMap: Record<string, string> = {};
    socialItems.forEach((item) => {
      if (item.platform.trim() && item.url.trim()) {
        currentMap[item.platform.trim()] = item.url.trim();
      }
    });

    const baselineMap = serverData.profile.socialLinks || {};
    const currentKeys = Object.keys(currentMap);
    const baselineKeys = Object.keys(baselineMap);

    if (currentKeys.length !== baselineKeys.length) return true;

    for (const key of currentKeys) {
      if (currentMap[key] !== baselineMap[key]) return true;
    }

    return false;
  }, [serverData, socialItems]);

  // Handlers — Save Account
  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !isAccountDirty) return;

    try {
      setSavingAccount(true);
      setAccountFeedback(null);

      const payload: UpdateAccountPayload = {};
      if (displayName.trim() !== (serverData?.account.displayName || '')) {
        payload.displayName = displayName.trim();
      }
      if (username.trim() !== (serverData?.account.username || '')) {
        payload.username = username.trim();
      }
      if ((avatarUrl.trim() || null) !== (serverData?.account.avatarUrl || null)) {
        payload.avatarUrl = avatarUrl.trim() || null;
      }

      const res = await updateAccountApi(accessToken, payload);

      setServerData((prev) =>
        prev
          ? {
              ...prev,
              account: {
                ...prev.account,
                displayName: res.account.displayName,
                username: res.account.username,
                avatarUrl: res.account.avatarUrl,
              },
            }
          : null
      );

      setAccountFeedback({ type: 'success', message: 'Account settings saved successfully.' });
    } catch (err: any) {
      setAccountFeedback({ type: 'error', message: err.message || 'Failed to update account settings.' });
    } finally {
      setSavingAccount(false);
    }
  }

  // Handlers — Save Profile
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !isProfileDirty) return;

    try {
      setSavingProfile(true);
      setProfileFeedback(null);

      const payload: UpdateProfilePayload = {};
      if (isPublic !== (serverData?.profile.isPublic ?? false)) {
        payload.isPublic = isPublic;
      }
      if (headline.trim() !== (serverData?.profile.headline || '')) {
        payload.headline = headline.trim() || null;
      }
      if (bio.trim() !== (serverData?.profile.bio || '')) {
        payload.bio = bio.trim() || null;
      }

      const res = await updateProfileApi(accessToken, payload);

      setServerData((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                isPublic: res.profile.isPublic,
                headline: res.profile.headline,
                bio: res.profile.bio,
              },
            }
          : null
      );

      setProfileFeedback({ type: 'success', message: 'Public profile settings saved successfully.' });
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Failed to update public profile.' });
    } finally {
      setSavingProfile(false);
    }
  }

  // Handlers — Social Links
  function handleAddSocial() {
    setSocialItems((prev) => [
      ...prev,
      { id: `soc-new-${Date.now()}`, platform: '', url: '' },
    ]);
  }

  function handleRemoveSocial(id: string) {
    setSocialItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSocialChange(id: string, field: 'platform' | 'url', value: string) {
    setSocialItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleSaveSocials(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !isSocialsDirty) return;

    setSocialsFeedback(null);
    const socialMap: Record<string, string> = {};

    for (const item of socialItems) {
      const platformKey = item.platform.trim().toLowerCase();
      const urlValue = item.url.trim();

      if (!platformKey && !urlValue) continue;

      if (!platformKey || !urlValue) {
        setSocialsFeedback({
          type: 'error',
          message: 'Both platform name and URL are required for every social link.',
        });
        return;
      }

      if (!isValidHttpUrl(urlValue)) {
        setSocialsFeedback({
          type: 'error',
          message: `Invalid URL '${urlValue}' for platform '${platformKey}'. URLs must start with http:// or https://.`,
        });
        return;
      }

      socialMap[platformKey] = urlValue;
    }

    try {
      setSavingSocials(true);
      const res = await updateProfileApi(accessToken, { socialLinks: socialMap });

      setServerData((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                socialLinks: res.profile.socialLinks,
              },
            }
          : null
      );

      setSocialsFeedback({ type: 'success', message: 'Social links saved successfully.' });
    } catch (err: any) {
      setSocialsFeedback({ type: 'error', message: err.message || 'Failed to update social links.' });
    } finally {
      setSavingSocials(false);
    }
  }

  // Handlers — Connect GitHub (Two-Step Authenticated OAuth Flow)
  async function handleConnectGithub() {
    if (!accessToken) return;
    try {
      setConnectingGithub(true);
      setGithubFeedback(null);

      const res = await getGithubAuthorizationUrlApi(accessToken);
      const targetUrl = res.authorizationUrl || res.url;
      if (targetUrl) {
        window.location.assign(targetUrl);
      } else {
        throw new Error('No authorization URL returned from backend server');
      }
    } catch (err: any) {
      setGithubFeedback({
        type: 'error',
        message: err.message || 'Failed to initiate GitHub authorization. Please try again.',
      });
      setConnectingGithub(false);
    }
  }

  // Handlers — Disconnect GitHub
  async function handleDisconnectGithub() {
    if (!accessToken) return;
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to disconnect your GitHub account?')) {
      return;
    }

    try {
      setDisconnectingGithub(true);
      setGithubFeedback(null);
      await disconnectGithubApi(accessToken);

      // Re-fetch authoritative settings baseline from server
      const updatedSettings = await getSettingsApi(accessToken);
      setServerData(updatedSettings);
      setGithubFeedback({ type: 'success', message: 'GitHub account disconnected successfully.' });
    } catch (err: any) {
      setGithubFeedback({
        type: 'error',
        message: err.message || 'Failed to disconnect GitHub account. Please try again.',
      });
    } finally {
      setDisconnectingGithub(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0D0F12] text-[#E6EDF3] p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#8B949E]">
          <svg className="w-5 h-5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading settings...
        </div>
      </div>
    );
  }

  if (fetchError || !accessToken) {
    return (
      <div className="min-h-screen bg-[#0D0F12] text-[#E6EDF3] p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#161B22] p-6 rounded-2xl border border-[#30363D] space-y-4 text-center">
          <h1 className="text-base font-bold text-white">Access Unavailable</h1>
          <p className="text-xs text-[#8B949E]">
            {fetchError || 'You must be logged in to view your settings.'}
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0F12] text-[#E6EDF3] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-[#30363D] pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Account & Profile Settings</h1>
            <p className="text-xs text-[#8B949E] mt-1">
              Manage your personal DevOS identity, public profile settings, and connected integrations.
            </p>
          </div>
          {serverData?.account?.username && (
            <Link
              href={`/p/${serverData.account.username}`}
              className="px-3 py-1.5 bg-[#161B22] hover:bg-[#1C2128] border border-[#30363D] rounded-lg text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5"
            >
              View Public Profile →
            </Link>
          )}
        </header>

        {/* SECTION 1 — ACCOUNT SETTINGS */}
        <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-6">
          <div className="border-b border-[#30363D] pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Information
            </h2>
            <p className="text-xs text-[#8B949E] mt-0.5">
              Update your primary display name, handle, and avatar preview.
            </p>
          </div>

          {accountFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                accountFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/80 border-red-800 text-red-300'
              }`}
            >
              {accountFeedback.message}
            </div>
          )}

          <form onSubmit={handleSaveAccount} className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[#1C2128] rounded-xl border border-[#30363D]">
              <div className="relative w-14 h-14 rounded-full overflow-hidden bg-[#0D0F12] border border-[#30363D] flex items-center justify-center text-sm font-bold text-purple-400 shrink-0">
                {avatarUrl && isValidHttpUrl(avatarUrl) ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || 'Avatar'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{getInitials(displayName || username)}</span>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Avatar Preview</span>
                <span className="text-[11px] text-[#8B949E] block">
                  Provide an HTTP or HTTPS image URL to customize your avatar.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider block">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider block">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alexrivera"
                  className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider block">
                Avatar Image URL (HTTP / HTTPS)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://avatars.githubusercontent.com/u/1234567"
                className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!isAccountDirty || savingAccount}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                  isAccountDirty && !savingAccount
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-[#1C2128] text-[#8B949E] border border-[#30363D] cursor-not-allowed'
                }`}
              >
                {savingAccount ? 'Saving Account...' : 'Save Account Settings'}
              </button>
            </div>
          </form>
        </section>

        {/* SECTION 2 — PUBLIC PROFILE SETTINGS */}
        <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-6">
          <div className="border-b border-[#30363D] pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Public Profile Configuration
            </h2>
            <p className="text-xs text-[#8B949E] mt-0.5">
              Control your public developer profile visibility, headline, and bio.
            </p>
          </div>

          {profileFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                profileFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/80 border-red-800 text-red-300'
              }`}
            >
              {profileFeedback.message}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#1C2128] rounded-xl border border-[#30363D]">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Public Profile Visibility</span>
                <span className="text-[11px] text-[#8B949E] block">
                  When enabled, your public developer profile will be visible at{' '}
                  <span className="font-mono text-purple-400">/p/{username || 'username'}</span>.
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0D0F12] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 border border-[#30363D]"></div>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider block">
                Professional Headline
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Full-Stack Engineer & Open Source Contributor"
                className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider block">
                Developer Bio
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a brief developer bio showcasing your expertise and proof-of-work achievements..."
                className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!isProfileDirty || savingProfile}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                  isProfileDirty && !savingProfile
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-[#1C2128] text-[#8B949E] border border-[#30363D] cursor-not-allowed'
                }`}
              >
                {savingProfile ? 'Saving Profile...' : 'Save Profile Settings'}
              </button>
            </div>
          </form>
        </section>

        {/* SECTION 3 — SOCIAL LINKS EDITOR */}
        <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Social Links & Profiles
              </h2>
              <p className="text-xs text-[#8B949E] mt-0.5">
                Add verified social links to showcase on your public developer profile.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddSocial}
              className="px-3 py-1.5 bg-[#1C2128] hover:bg-[#21262D] border border-[#30363D] rounded-lg text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 focus:outline-none"
            >
              + Add Link
            </button>
          </div>

          {socialsFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                socialsFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/80 border-red-800 text-red-300'
              }`}
            >
              {socialsFeedback.message}
            </div>
          )}

          <form onSubmit={handleSaveSocials} className="space-y-4">
            {socialItems.length === 0 ? (
              <div className="p-6 text-center bg-[#1C2128] rounded-xl border border-[#30363D]">
                <p className="text-xs text-[#8B949E]">No social links configured yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {socialItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-[#1C2128] rounded-xl border border-[#30363D]">
                    <div className="w-1/3">
                      <input
                        type="text"
                        value={item.platform}
                        onChange={(e) => handleSocialChange(item.id, 'platform', e.target.value)}
                        placeholder="Platform (e.g. github)"
                        className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.url}
                        onChange={(e) => handleSocialChange(item.id, 'url', e.target.value)}
                        placeholder="https://github.com/username"
                        className="w-full px-3 py-2 bg-[#0D0F12] border border-[#30363D] rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSocial(item.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900 transition-colors"
                      aria-label="Remove social link"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!isSocialsDirty || savingSocials}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                  isSocialsDirty && !savingSocials
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-[#1C2128] text-[#8B949E] border border-[#30363D] cursor-not-allowed'
                }`}
              >
                {savingSocials ? 'Saving Links...' : 'Save Social Links'}
              </button>
            </div>
          </form>
        </section>

        {/* SECTION 4 — GITHUB CONNECTION SETTINGS */}
        <section className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub Integration
              </h2>
              <p className="text-xs text-[#8B949E] mt-0.5">
                Connect your GitHub account to enable verified identity and proof-of-work evidence features.
              </p>
            </div>

            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                serverData?.github?.connected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-slate-900 text-[#8B949E] border-[#30363D]'
              }`}
            >
              {serverData?.github?.connected ? '● Connected' : '○ Not Connected'}
            </span>
          </div>

          {githubFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                githubFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/80 border-red-800 text-red-300'
              }`}
            >
              {githubFeedback.message}
            </div>
          )}

          <div className="p-4 bg-[#1C2128] rounded-xl border border-[#30363D] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white block">
                {serverData?.github?.connected ? 'GitHub Account Linked' : 'Connect your GitHub Account'}
              </span>
              <p className="text-[11px] text-[#8B949E]">
                {serverData?.github?.connected
                  ? 'Your DevOS profile is connected to GitHub. Disconnecting will remove your OAuth credentials while preserving existing evidence history.'
                  : 'Click below to authorize DevOS on GitHub using secure OAuth.'}
              </p>
            </div>

            {serverData?.github?.connected ? (
              <button
                type="button"
                onClick={handleDisconnectGithub}
                disabled={disconnectingGithub}
                className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800 font-bold text-xs rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 shrink-0"
              >
                {disconnectingGithub ? 'Disconnecting...' : 'Disconnect GitHub'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGithub}
                disabled={connectingGithub}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 shrink-0"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                {connectingGithub ? 'Connecting to GitHub...' : 'Connect GitHub'}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
