export interface ApiFetchOptions extends RequestInit {
  accessToken?: string | null;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

/**
 * Returns the configured API base URL without trailing slashes.
 * Priority: process.env.NEXT_PUBLIC_API_URL -> http://localhost:3001
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:3001';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Constructs a fully qualified API URL given a relative or full endpoint path.
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If path doesn't start with /api/v1 and baseUrl doesn't end with /api/v1
  if (!cleanPath.startsWith('/api/v1') && !baseUrl.endsWith('/api/v1')) {
    return `${baseUrl}/api/v1${cleanPath}`;
  }
  return `${baseUrl}${cleanPath}`;
}

/**
 * Helper to extract human-readable error messages from NestJS API responses.
 * Correctly handles string messages, array messages (NestJS ValidationPipe), or object errors.
 */
function parseErrorMessage(errorData: any, status: number): string {
  if (Array.isArray(errorData?.message)) {
    return errorData.message.join(', ');
  }
  if (typeof errorData?.message === 'string' && errorData.message.trim()) {
    return errorData.message;
  }
  if (typeof errorData?.error === 'string' && errorData.error.trim()) {
    return errorData.error;
  }
  return `API Request Failed (${status})`;
}

/**
 * Central fetch wrapper for DevOS backend communication.
 * Includes credentials (cookies) by default and attaches Bearer authorization header if accessToken is provided.
 * Features automatic single 401 token refresh & retry for non-auth endpoints.
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { accessToken, headers: customHeaders, ...restOptions } = options;
  const url = getApiUrl(path);

  const headers: Record<string, string> = {
    ...(restOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(customHeaders as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    headers,
    credentials: 'include',
    ...restOptions,
  });

  if (!res.ok) {
    // 401 Recovery: Attempt token refresh once if request failed with 401 and isn't an auth endpoint itself
    const isAuthEndpoint =
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/refresh') ||
      path.includes('/auth/logout');

    if (res.status === 401 && !isAuthEndpoint) {
      try {
        const refreshData = await refreshApi();
        if (refreshData?.accessToken) {
          const retryHeaders: Record<string, string> = {
            ...headers,
            Authorization: `Bearer ${refreshData.accessToken}`,
          };
          const retryRes = await fetch(url, {
            headers: retryHeaders,
            credentials: 'include',
            ...restOptions,
          });

          if (retryRes.ok) {
            if (retryRes.status === 204) {
              return {} as T;
            }
            return retryRes.json();
          }

          const retryErrorData = await retryRes.json().catch(() => ({}));
          const retryMessage = parseErrorMessage(retryErrorData, retryRes.status);
          throw new ApiError(retryRes.status, retryMessage, retryErrorData);
        }
      } catch (refreshErr) {
        // If refresh fails, continue below to throw the original 401 ApiError
      }
    }

    const errorData = await res.json().catch(() => ({}));
    const message = parseErrorMessage(errorData, res.status);
    throw new ApiError(res.status, message, errorData);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// Dedicated authentication API helpers
export async function loginApi(payload: { identity: string; password: string }) {
  return apiFetch<{ accessToken: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function registerApi(payload: { email: string; username: string; password: string }) {
  return apiFetch<{ accessToken: string }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refreshApi() {
  return apiFetch<{ accessToken: string }>('/api/v1/auth/refresh', {
    method: 'POST',
  });
}

export async function logoutApi() {
  return apiFetch<{ success: boolean }>('/api/v1/auth/logout', {
    method: 'POST',
  });
}

export async function getMeApi(accessToken: string) {
  return apiFetch<{ user: any; stats: any }>('/api/v1/auth/me', {
    method: 'GET',
    accessToken,
  });
}

export interface XpLedgerEntryDto {
  id: string;
  sourceType: string;
  sourceId: string | null;
  xpDelta: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface XpSummaryResponseDto {
  totalXp: number;
  weeklyXp: number;
  monthlyXp: number;
  recentEntries: XpLedgerEntryDto[];
}

export async function getXpSummaryApi(accessToken?: string | null) {
  return apiFetch<XpSummaryResponseDto>('/api/v1/me/xp', {
    method: 'GET',
    accessToken,
  });
}

export interface AchievementCatalogueItemDto {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

export async function getAchievementsCatalogueApi(accessToken?: string | null) {
  return apiFetch<AchievementCatalogueItemDto[]>('/api/v1/me/achievements', {
    method: 'GET',
    accessToken,
  });
}

/* ==========================================
 * Public Developer Profile API Helpers
 * ========================================== */

export interface PublicProfileIdentityDto {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  socialLinks: Record<string, string>;
}

export interface PublicProfileGamificationDto {
  totalXp: number;
  level: number;
  levelTitle: string;
  currentStreak: number;
  longestStreak: number;
  earnedAchievements: Array<{
    code: string;
    name: string;
    description: string;
    icon: string | null;
    category: string | null;
    xpReward: number;
    earnedAt: string;
  }>;
}

export interface PublicProfileJourneyDto {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isFeatured: boolean;
  milestonesCount: number;
  completedMilestonesCount: number;
  tasksCount: number;
  completedTasksCount: number;
}

export interface PublicProfileEvidenceDto {
  id: string;
  evidenceType: string;
  title: string;
  githubRepo: string | null;
  githubSha: string | null;
  url: string | null;
  createdAt: string;
}


export interface PublicProfileResponseDto {
  identity: PublicProfileIdentityDto;
  gamification: PublicProfileGamificationDto;
  journeys: PublicProfileJourneyDto[];
  proofOfWork: PublicProfileEvidenceDto[];
}

export async function getPublicProfileApi(username: string): Promise<PublicProfileResponseDto | null> {
  try {
    return await apiFetch<PublicProfileResponseDto>(`/api/v1/p/${encodeURIComponent(username)}`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch (err: any) {
    if (err?.status === 404) {
      return null;
    }
    throw err;
  }
}

export interface PublicActivityResponseDto {
  username: string;
  activityWindow: {
    startDate: string;
    endDate: string;
  };
  activityDates: Array<{
    date: string;
    count: number;
  }>;
}

export async function getPublicActivityApi(username: string): Promise<PublicActivityResponseDto | null> {
  try {
    return await apiFetch<PublicActivityResponseDto>(`/api/v1/p/${encodeURIComponent(username)}/activity`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch (err: any) {
    if (err?.status === 404) {
      return null;
    }
    return null;
  }
}

/* ==========================================
 * Settings APIs (Phase 7)
 * ========================================== */

export interface SettingsAccountDto {
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface SettingsProfileDto {
  isPublic: boolean;
  headline: string | null;
  bio: string | null;
  socialLinks: Record<string, string>;
}

export interface SettingsGithubDto {
  connected: boolean;
}

export interface SettingsResponseDto {
  account: SettingsAccountDto;
  profile: SettingsProfileDto;
  github: SettingsGithubDto;
}

export interface UpdateAccountPayload {
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
}

export interface UpdateAccountResponseDto {
  account: SettingsAccountDto;
}

export interface UpdateProfilePayload {
  isPublic?: boolean;
  headline?: string | null;
  bio?: string | null;
  socialLinks?: Record<string, string>;
}

export interface UpdateProfileResponseDto {
  profile: SettingsProfileDto;
}

export async function getSettingsApi(accessToken: string): Promise<SettingsResponseDto> {
  return apiFetch<SettingsResponseDto>('/api/v1/me/settings', {
    method: 'GET',
    accessToken,
    cache: 'no-store',
  });
}

export async function updateAccountApi(
  accessToken: string,
  payload: UpdateAccountPayload
): Promise<UpdateAccountResponseDto> {
  return apiFetch<UpdateAccountResponseDto>('/api/v1/me/account', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function updateProfileApi(
  accessToken: string,
  payload: UpdateProfilePayload
): Promise<UpdateProfileResponseDto> {
  return apiFetch<UpdateProfileResponseDto>('/api/v1/me/profile', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export interface GitHubAuthorizationUrlResponseDto {
  url: string;
  authorizationUrl: string;
}

export async function getGithubAuthorizationUrlApi(
  accessToken?: string
): Promise<GitHubAuthorizationUrlResponseDto> {
  return apiFetch<GitHubAuthorizationUrlResponseDto>('/api/v1/auth/oauth/github', {
    method: 'GET',
    accessToken,
  });
}

export async function disconnectGithubApi(
  accessToken?: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/api/v1/me/github', {
    method: 'DELETE',
    accessToken,
  });
}

/* ==========================================
 * CSV Import API Helpers (Phase 8B)
 * ========================================== */

export interface CsvRowErrorDto {
  row: number;
  column: string;
  message: string;
}

export interface CsvPreviewResponseDto {
  previewToken: string | null;
  journeyId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  milestonesExisting: string[];
  milestonesToCreate: string[];
  tasksToCreate: number;
  errors: CsvRowErrorDto[];
}

export interface CsvExecuteResponseDto {
  success: boolean;
  status: string;
  tasksCreated: number;
  milestonesCreated: number;
}

export async function previewCsvImportApi(
  journeyId: string,
  file: File,
  accessToken?: string | null
): Promise<CsvPreviewResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<CsvPreviewResponseDto>(
    `/api/v1/journeys/${encodeURIComponent(journeyId)}/import/csv/preview`,
    {
      method: 'POST',
      accessToken,
      body: formData,
    }
  );
}

export async function executeCsvImportApi(
  journeyId: string,
  previewToken: string,
  accessToken?: string | null
): Promise<CsvExecuteResponseDto> {
  return apiFetch<CsvExecuteResponseDto>(
    `/api/v1/journeys/${encodeURIComponent(journeyId)}/import/csv/execute`,
    {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ previewToken }),
    }
  );
}








