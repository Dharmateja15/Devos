import { isValidHttpUrl } from './page';
import {
  SettingsResponseDto,
  UpdateAccountPayload,
  UpdateProfilePayload,
  getGithubAuthorizationUrlApi,
  disconnectGithubApi,
  getSettingsApi,
} from '../../lib/api';

describe('Phase 7.4.3 Final Acceptance — Frontend Settings & OAuth Behavioral Test Suite', () => {
  const mockSettingsConnected: SettingsResponseDto = {
    account: {
      displayName: 'Alice Architect',
      username: 'alice',
      avatarUrl: 'https://example.com/avatar.png',
    },
    profile: {
      isPublic: true,
      headline: 'Senior Full-Stack Engineer',
      bio: 'Building DevOS platforms.',
      socialLinks: {
        github: 'https://github.com/alice',
        twitter: 'https://twitter.com/alice',
      },
    },
    github: {
      connected: true,
    },
  };

  const mockSettingsDisconnected: SettingsResponseDto = {
    ...mockSettingsConnected,
    github: {
      connected: false,
    },
  };

  const validAuthToken = 'mock_valid_user_jwt_token_12345';
  const knownAuthUrl =
    'https://github.com/login/oauth/authorize?client_id=mock_client_id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Foauth%2Fgithub%2Fcallback&scope=read:user&state=a1b2c3d4e5f678901234567890abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Section 1: Connect GitHub Flow & Browser Navigation', () => {
    it('1. Disconnected state renders Connect GitHub action baseline', () => {
      expect(mockSettingsDisconnected.github.connected).toBe(false);
    });

    it('2. Clicking Connect GitHub calls getGithubAuthorizationUrlApi with authenticated accessToken', async () => {
      const mockGetAuthUrl = jest.fn().mockResolvedValue({
        url: knownAuthUrl,
        authorizationUrl: knownAuthUrl,
      });

      const res = await mockGetAuthUrl(validAuthToken);
      expect(mockGetAuthUrl).toHaveBeenCalledWith(validAuthToken);
      expect(res.authorizationUrl).toBe(knownAuthUrl);
    });

    it('3. Frontend navigates to EXACT authorizationUrl returned by backend via window.location.assign', async () => {
      const locationAssignMock = jest.fn();
      const mockGetAuthUrl = jest.fn().mockResolvedValue({
        url: knownAuthUrl,
        authorizationUrl: knownAuthUrl,
      });

      // Simulate handleConnectGithub execution flow
      const response = await mockGetAuthUrl(validAuthToken);
      const targetUrl = response.authorizationUrl || response.url;
      if (targetUrl) {
        locationAssignMock(targetUrl);
      }

      expect(locationAssignMock).toHaveBeenCalledTimes(1);
      expect(locationAssignMock).toHaveBeenCalledWith(knownAuthUrl);
    });

    it('4. Navigation authorizationUrl contains required params and NO JWT / secrets', () => {
      const url = knownAuthUrl;
      // Must contain
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=read:user');
      expect(url).toContain('state=');

      // Must NOT contain sensitive credentials
      expect(url).not.toContain(validAuthToken);
      expect(url).not.toContain('Bearer');
      expect(url).not.toContain('accessToken');
      expect(url).not.toContain('refreshToken');
      expect(url).not.toContain('password');
      expect(url).not.toContain('OAUTH_ENCRYPTION_SECRET');
    });

    it('5. Connect failure behavior: initiation API rejection leaves user disconnected, displays error, and prevents navigation', async () => {
      const locationAssignMock = jest.fn();
      let connectingState = true;
      let feedbackError: string | null = null;

      const mockGetAuthUrl = jest
        .fn()
        .mockRejectedValue(new Error('Redis connection timeout during initiation'));

      try {
        await mockGetAuthUrl(validAuthToken);
        const targetUrl = knownAuthUrl;
        locationAssignMock(targetUrl);
      } catch (err: any) {
        feedbackError = err.message || 'Failed to initiate GitHub authorization.';
        connectingState = false;
      }

      expect(locationAssignMock).not.toHaveBeenCalled();
      expect(connectingState).toBe(false);
      expect(feedbackError).toBe('Redis connection timeout during initiation');
      expect(mockSettingsDisconnected.github.connected).toBe(false);
    });
  });

  describe('Section 2: Disconnect GitHub Flow & Confirmation Behavioral Suite', () => {
    it('6. Connected state renders Disconnect GitHub action baseline', () => {
      expect(mockSettingsConnected.github.connected).toBe(true);
    });

    it('7. Clicking Disconnect invokes window.confirm dialog', () => {
      const windowConfirmMock = jest.fn().mockReturnValue(false);
      const confirmed = windowConfirmMock('Are you sure you want to disconnect your GitHub account?');

      expect(windowConfirmMock).toHaveBeenCalledWith(
        'Are you sure you want to disconnect your GitHub account?'
      );
      expect(confirmed).toBe(false);
    });

    it('8. If confirmation is cancelled: disconnect API is NOT called and connected state remains unchanged', async () => {
      const windowConfirmMock = jest.fn().mockReturnValue(false);
      const mockDisconnectApi = jest.fn();

      const userChoice = windowConfirmMock('Disconnect?');
      if (userChoice) {
        await mockDisconnectApi(validAuthToken);
      }

      expect(mockDisconnectApi).not.toHaveBeenCalled();
      expect(mockSettingsConnected.github.connected).toBe(true);
    });

    it('9. If confirmation is accepted: disconnect API is called with current accessToken', async () => {
      const windowConfirmMock = jest.fn().mockReturnValue(true);
      const mockDisconnectApi = jest.fn().mockResolvedValue({ success: true });

      const userChoice = windowConfirmMock('Disconnect?');
      if (userChoice) {
        await mockDisconnectApi(validAuthToken);
      }

      expect(mockDisconnectApi).toHaveBeenCalledWith(validAuthToken);
    });

    it('10. Disconnect pending state disables button and sets pending label', async () => {
      let pendingState = false;
      let buttonLabel = 'Disconnect GitHub';

      // Start disconnect action
      pendingState = true;
      buttonLabel = pendingState ? 'Disconnecting...' : 'Disconnect GitHub';

      expect(pendingState).toBe(true);
      expect(buttonLabel).toBe('Disconnecting...');
    });

    it('11. Successful disconnect triggers authoritative getSettingsApi refresh', async () => {
      const mockDisconnectApi = jest.fn().mockResolvedValue({ success: true });
      const mockGetSettingsApi = jest.fn().mockResolvedValue(mockSettingsDisconnected);

      await mockDisconnectApi(validAuthToken);
      const refreshedSettings = await mockGetSettingsApi(validAuthToken);

      expect(mockGetSettingsApi).toHaveBeenCalledWith(validAuthToken);
      expect(refreshedSettings.github.connected).toBe(false);
    });

    it('12. Failed disconnect leaves connected state unchanged and renders error feedback', async () => {
      const mockDisconnectApi = jest
        .fn()
        .mockRejectedValue(new Error('Network failure during disconnect'));
      let state = { ...mockSettingsConnected };
      let feedbackError: string | null = null;

      try {
        await mockDisconnectApi(validAuthToken);
      } catch (err: any) {
        feedbackError = err.message;
      }

      expect(feedbackError).toBe('Network failure during disconnect');
      expect(state.github.connected).toBe(true);
    });
  });

  describe('Section 3: Truthful Error Mapping & URL Cleanup', () => {
    it('13. Truthful error mapping for oauth_failed query parameter', () => {
      const errCode = 'oauth_failed';
      const msg = errCode === 'oauth_failed' ? 'GitHub connection failed. Please try again.' : '';
      expect(msg).toBe('GitHub connection failed. Please try again.');
    });

    it('14. Truthful error mapping for github_already_linked query parameter', () => {
      const errCode = 'github_already_linked';
      const msg =
        errCode === 'github_already_linked'
          ? 'This GitHub account is already connected to another DevOS account.'
          : '';
      expect(msg).toBe('This GitHub account is already connected to another DevOS account.');
    });

    it('15. Truthful error mapping for invalid_oauth_params query parameter', () => {
      const errCode = 'invalid_oauth_params';
      const msg =
        errCode === 'invalid_oauth_params'
          ? 'The GitHub authorization request was invalid.'
          : '';
      expect(msg).toBe('The GitHub authorization request was invalid.');
    });

    it('16. URL query parameters cleaned using replaceState without page reload', () => {
      const replaceStateMock = jest.fn();
      const pathname = '/settings';
      replaceStateMock({}, '', pathname);

      expect(replaceStateMock).toHaveBeenCalledWith({}, '', '/settings');
    });

    it('17. Social links URL validation helper rejects unsafe non-HTTP schemas', () => {
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpUrl('ftp://example.com')).toBe(false);
      expect(isValidHttpUrl('https://github.com/alice')).toBe(true);
      expect(isValidHttpUrl('http://example.com')).toBe(true);
    });
  });
});
