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
    'Content-Type': 'application/json',
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
