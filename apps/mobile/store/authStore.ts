import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api, { connectAuthStore } from '../apis/authApi';
import { validateUsernameFrontend, validatePasswordFrontend, validateEmailFrontend } from '../utils/validation';

// Types for device info
type DeviceInfo = {
  model: string | null;
  osName: string | null;
  osVersion: string | null;
  platform: string;
  brand: string | null;
  manufacturer: string | null;
  deviceName: string | null;
  deviceType: number | null;
};

type NetworkInfo = {
  ipAddress: string;
  country: string;
};

type FingerprintResult = {
  fingerprint: string;
  deviceInfo: DeviceInfo;
  networkInfo: NetworkInfo;
};

type UserData = {
  username: string;
  email: string;
  password: string;
  enableTOTP?: boolean;
  fingerprint: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  country?: string;
};

type LoginData = {
  usernameOrEmail: string;
  password: string;
  code?: string;
};

type AuthResponse = {
  success: boolean;
  message: string;
  requiresEmailVerification?: boolean;
  requiresDeviceVerification?: boolean;
  requiresOtp?: boolean;
  requiresTOTPSetup?: boolean;
  requiresTOTPCode?: boolean;
  action?: 'signup' | 'login';
  email?: string;
  verified?: boolean;
  fingerprint?: string;
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
  user?: any;
  usernameOrEmail?: string;
  backupCodesRemaining?: number;
  usedBackupCode?: boolean;
  warningMessage?: string;
  twoFactorEnabled?: boolean;
};

type TOTPSetupResponse = {
  success: boolean;
  secret?: string;
  message?: string;
};

type DisableTOTPResponse = {
  success: boolean;
  message?: string;
  twoFactorEnabled?: boolean;
};

type AuthState = {
  user: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  fingerprint: string | null;
  csrfToken: string | null;
  requiresOtp: boolean;
  requiresEmailVerification: boolean;
  requiresDeviceVerification: boolean;
  requiresTOTPSetup: boolean;
  requiresTOTPCode: boolean;
  pendingUsernameOrEmail: string | null;
  emailVerificationSuccess: string | null;
  setTokens: (access: string, refresh: string, csrf: string) => Promise<void>;
  register: (userData: UserData) => Promise<AuthResponse>;
  login: (loginData: LoginData) => Promise<AuthResponse>;
  verifyDevice: (code: string, usernameOrEmail: string) => Promise<AuthResponse>;
  resendVerifyDevice: (usernameOrEmail: string) => Promise<AuthResponse>;
  verifyEmail: (code: string) => Promise<AuthResponse>;
  resendVerifyEmail: (usernameOrEmail: string) => Promise<AuthResponse>;
  requestPasswordReset: (email: string) => Promise<AuthResponse>;
  verifyResetToken: (token: string) => Promise<AuthResponse>;
  resetPassword: (email: string, newPassword: string, confirmPassword: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  initializeAuth: () => Promise<boolean>;
  setupTOTP: () => Promise<TOTPSetupResponse>;
  setupTOTPLogin: (usernameOrEmail: string) => Promise<TOTPSetupResponse>;
  verifyTOTPSetup: (totpCode: string) => Promise<AuthResponse>;
  verifyTOTPSetupLogin: (totpCode: string, usernameOrEmail: string, fingerprint: string) => Promise<AuthResponse>;
  verifyTOTPLogin: (code: string, usernameOrEmail: string, fingerprint: string) => Promise<AuthResponse>;
  disableTOTP: (password: string) => Promise<DisableTOTPResponse>;
  generateFingerprint: () => Promise<FingerprintResult>;
  getFingerprintString: () => Promise<string>;
  setEmailVerificationSuccess: (message: string | null) => void;
  clearEmailVerificationSuccess: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  fingerprint: null,
  csrfToken: null,
  requiresOtp: false,
  requiresEmailVerification: false,
  requiresDeviceVerification: false,
  requiresTOTPSetup: false,
  requiresTOTPCode: false,
  pendingUsernameOrEmail: null,
  emailVerificationSuccess: null,

  setEmailVerificationSuccess: (message) => set({ emailVerificationSuccess: message }),
  clearEmailVerificationSuccess: () => set({ emailVerificationSuccess: null }),

  getFingerprintString: async (): Promise<string> => {
    const result = await get().generateFingerprint();
    return result.fingerprint;
  },

  generateFingerprint: async (): Promise<FingerprintResult> => {
    try {
      let deviceId = await SecureStore.getItemAsync('deviceId');

      const deviceInfo: DeviceInfo = {
        model: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        platform: Platform.OS,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        deviceName: Device.deviceName,
        deviceType: Device.deviceType,
      };

      if (deviceId) {
        console.log('generateFingerprint: Using stored fingerprint:', {
          deviceId,
          deviceInfo
        });
        return {
          fingerprint: deviceId,
          deviceInfo,
          networkInfo: { ipAddress: 'unknown', country: 'unknown' }
        };
      }

      const deviceInfoString = `${deviceInfo.model || 'unknown'}-${deviceInfo.osName || 'unknown'}-${deviceInfo.osVersion || 'unknown'}`;
      const seed = `${Date.now()}-${Math.random()}-${Platform.OS}-${deviceInfoString}`;
      deviceId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
      await SecureStore.setItemAsync('deviceId', deviceId);

      console.log('generateFingerprint: Generated new fingerprint:', {
        deviceId,
        deviceInfo
      });

      return {
        fingerprint: deviceId,
        deviceInfo,
        networkInfo: { ipAddress: 'unknown', country: 'unknown' }
      };
    } catch (error: any) {
      console.error('generateFingerprint: Error:', { message: error.message });
      const fallbackId = `fallback-${Date.now()}-${Math.random()}`;
      await SecureStore.setItemAsync('deviceId', fallbackId);

      return {
        fingerprint: fallbackId,
        deviceInfo: {
          model: 'unknown',
          osName: 'unknown',
          osVersion: 'unknown',
          platform: Platform.OS,
          brand: 'unknown',
          manufacturer: 'unknown',
          deviceName: 'unknown',
          deviceType: null
        },
        networkInfo: { ipAddress: 'unknown', country: 'unknown' }
      };
    }
  },

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      console.log('initializeAuth: Starting auth initialization');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const fingerprint = await SecureStore.getItemAsync('deviceId');

      console.log('initializeAuth: Retrieved stored values', {
        hasRefreshToken: !!refreshToken,
        hasAccessToken: !!accessToken,
        hasFingerprint: !!fingerprint
      });

      if (!refreshToken || !accessToken || !fingerprint) {
        console.log('initializeAuth: Missing tokens or fingerprint, setting unauthenticated');
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          fingerprint: null,
          csrfToken: null,
          isLoading: false
        });
        return false;
      }

      set({ accessToken, refreshToken, fingerprint });
      console.log('initializeAuth: Tokens and fingerprint set in state');

      const refreshSuccess = await get().refresh();
      console.log('initializeAuth: Refresh attempt completed', { refreshSuccess });

      if (!refreshSuccess) {
        console.log('initializeAuth: Token refresh failed, clearing state');
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          fingerprint: null,
          csrfToken: null,
          isLoading: false
        });
        await Promise.all([
          SecureStore.deleteItemAsync('refreshToken'),
          SecureStore.deleteItemAsync('accessToken'),
          SecureStore.deleteItemAsync('deviceId'),
        ]);
        return false;
      }

      console.log('initializeAuth: Fetching user profile');
      const { data } = await api.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('initializeAuth: Profile fetched', {
        username: data.user?.username,
        isActive: data.user?.isActive
      });

      if (!data.user?.isActive) {
        console.log('initializeAuth: User is not active, requires email verification');
        set({
          isAuthenticated: false,
          requiresEmailVerification: true,
          pendingUsernameOrEmail: data.user.email,
          isLoading: false
        });
        return false;
      }

      console.log('initializeAuth: Auth initialization successful');
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        requiresOtp: false,
        requiresEmailVerification: false,
        requiresDeviceVerification: false,
        requiresTOTPSetup: false,
        requiresTOTPCode: false,
        pendingUsernameOrEmail: null
      });
      return true;
    } catch (error: any) {
      console.error('initializeAuth: Error during initialization', {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });
      set({
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        user: null,
        fingerprint: null,
        csrfToken: null,
        isLoading: false
      });
      await Promise.all([
        SecureStore.deleteItemAsync('refreshToken'),
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('deviceId'),
      ]);
      return false;
    }
  },

  setTokens: async (access: string, refresh: string, csrf: string) => {
    set({ accessToken: access, refreshToken: refresh, csrfToken: csrf });
    try {
      await Promise.all([
        SecureStore.setItemAsync('accessToken', access),
        SecureStore.setItemAsync('refreshToken', refresh),
      ]);
      console.log('setTokens: Stored tokens', {
        accessTokenLength: access.length,
        refreshTokenLength: refresh.length
      });
    } catch (error: any) {
      console.error('setTokens: Failed to store tokens', { message: error.message });
    }
  },

  register: async (userData: UserData): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      const usernameValidation = validateUsernameFrontend(userData.username);
      const emailValidation = validateEmailFrontend(userData.email);
      const passwordValidation = validatePasswordFrontend(userData.password);

      if (!usernameValidation.isValid || !emailValidation.isValid || !passwordValidation.isValid) {
        const errors = [
          ...usernameValidation.errors,
          ...emailValidation.errors,
          ...passwordValidation.errors,
        ];
        set({ isLoading: false });
        return { success: false, message: errors.join(' ') };
      }

      console.log('📱 REGISTRATION ATTEMPT - DEVICE INFO:', {
        deviceInfo: userData.deviceInfo,
        ipAddress: userData.ipAddress,
        country: userData.country
      });

      console.log('👤 USER DATA:', {
        username: userData.username,
        email: userData.email,
        enableTOTP: userData.enableTOTP,
        fingerprint: userData.fingerprint
      });

      const { data } = await api.post('/api/auth/register', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        enableTOTP: userData.enableTOTP,
        fingerprint: userData.fingerprint,
        deviceInfo: userData.deviceInfo,
        ipAddress: userData.ipAddress,
        country: userData.country
      });

      if (data.requiresEmailVerification) {
        set({
          isLoading: false,
          pendingUsernameOrEmail: data.email || userData.email,
          requiresEmailVerification: true,
          requiresTOTPSetup: data.requiresTOTPSetup
        });
      } else {
        set({
          isLoading: false,
          requiresEmailVerification: false
        });
      }

      return {
        success: data.success !== false,
        message: data.message || 'Verification email sent',
        requiresEmailVerification: data.requiresEmailVerification,
        requiresTOTPSetup: data.requiresTOTPSetup,
        email: data.email,
        action: data.action
      };
    } catch (error: any) {
      console.error('register: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
        action: error.response?.data?.action
      };
    }
  },

  login: async (loginData: LoginData): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      const fingerprintResult = await get().generateFingerprint();
      const fingerprint = fingerprintResult.fingerprint;
      set({ fingerprint });
      console.log('login: Attempt', {
        usernameOrEmail: loginData.usernameOrEmail,
        fingerprint,
        code: loginData.code ? '[REDACTED]' : undefined
      });

      const { data } = await api.post('/api/auth/login', {
        usernameOrEmail: loginData.usernameOrEmail,
        password: loginData.password,
        code: loginData.code,
        fingerprint: fingerprint
      });
      console.log('login: Response', {
        requiresOtp: data.requiresOtp,
        requiresEmailVerification: data.requiresEmailVerification,
        requiresDeviceVerification: data.requiresDeviceVerification,
        requiresTOTPSetup: data.requiresTOTPSetup,
        requiresTOTPCode: data.requiresTOTPCode
      });

      if (data.requiresEmailVerification) {
        console.log('login: Email verification required');
        set({
          isLoading: false,
          requiresEmailVerification: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'Please verify your email to continue',
          requiresEmailVerification: true,
          email: data.email
        };
      }

      if (data.requiresDeviceVerification) {
        console.log('login: Device verification required');
        set({
          isLoading: false,
          requiresDeviceVerification: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'New device detected. Please check your email for verification code.',
          requiresDeviceVerification: true,
          fingerprint: data.fingerprint
        };
      }

      if (data.requiresTOTPSetup) {
        console.log('login: TOTP setup required');
        set({
          isLoading: false,
          requiresTOTPSetup: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'TOTP setup required. Please complete TOTP setup to continue.',
          requiresTOTPSetup: true,
          usernameOrEmail: data.usernameOrEmail
        };
      }

      if (data.requiresTOTPCode) {
        console.log('login: TOTP code required');
        set({
          isLoading: false,
          requiresTOTPCode: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'TOTP code required',
          requiresTOTPCode: true,
          usernameOrEmail: data.usernameOrEmail
        };
      }

      if (data.requiresOtp) {
        console.log('login: OTP required');
        set({
          isLoading: false,
          requiresOtp: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'OTP required',
          requiresOtp: true
        };
      }

      if (data.success) {
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken,
          isAuthenticated: true,
          isLoading: false,
          requiresOtp: false,
          requiresEmailVerification: false,
          requiresDeviceVerification: false,
          requiresTOTPSetup: false,
          requiresTOTPCode: false,
          pendingUsernameOrEmail: null,
        });
        await get().setTokens(data.accessToken, data.refreshToken, data.csrfToken);
        console.log('login: Success', { user: data.user.username });
        return {
          success: true,
          message: data.message || 'Login successful',
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken
        };
      } else {
        set({
          isLoading: false,
          requiresOtp: false,
          requiresEmailVerification: false,
          requiresDeviceVerification: false,
          requiresTOTPSetup: false,
          requiresTOTPCode: false,
          pendingUsernameOrEmail: null
        });
        return {
          success: false,
          message: data.message || 'Login failed',
          action: data.action
        };
      }
    } catch (error: any) {
      console.error('Login error:', error.message, error.code);

      // The backend answers "verify your email" with HTTP 400, so it lands here, not above
      if (error.response?.data?.requiresEmailVerification) {
        set({
          isLoading: false,
          requiresEmailVerification: true,
          pendingUsernameOrEmail: loginData.usernameOrEmail
        });
        return {
          success: false,
          message: error.response.data.message || 'Please verify your email to continue',
          requiresEmailVerification: true,
          email: error.response.data.email
        };
      }

      const message = error.code === 'ECONNABORTED' || error.message.includes('timeout')
        ? 'Server is waking up—please wait 1-2 minutes and try again.'
        : error.response?.data?.message || 'Login failed';

      set({
        isLoading: false,
        requiresOtp: false,
        requiresEmailVerification: false,
        requiresDeviceVerification: false,
        requiresTOTPSetup: false,
        requiresTOTPCode: false,
        pendingUsernameOrEmail: null
      });

      await Promise.all([
        SecureStore.deleteItemAsync('refreshToken'),
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('deviceId'),
      ]);

      return {
        success: false,
        message: message,
        action: error.response?.data?.action
      };
    }
  },

  verifyDevice: async (code: string, usernameOrEmail: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      const fingerprint = get().fingerprint;
      if (!fingerprint) {
        await Promise.all([
          SecureStore.deleteItemAsync('refreshToken'),
          SecureStore.deleteItemAsync('accessToken'),
          SecureStore.deleteItemAsync('deviceId'),
        ]);
        throw new Error('Device fingerprint missing');
      }

      console.log('verifyDevice: Attempt', {
        usernameOrEmail,
        code: '[REDACTED]',
        fingerprint
      });

      const { data } = await api.post('/api/auth/verify-device', {
        verificationCode: code,
        fingerprint,
        usernameOrEmail
      });

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        isAuthenticated: true,
        isLoading: false,
        requiresDeviceVerification: false,
        pendingUsernameOrEmail: null,
      });

      await get().setTokens(data.accessToken, data.refreshToken, data.csrfToken);
      console.log('verifyDevice: Success', { user: data.user.username });

      return {
        success: true,
        message: data.message || 'Device verified successfully',
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken
      };
    } catch (error: any) {
      console.error('verifyDevice: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });

      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Device verification failed'
      };
    }
  },

  resendVerifyDevice: async (usernameOrEmail: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      const fingerprint = get().fingerprint;
      console.log('resendVerifyDevice: Attempt', { usernameOrEmail, fingerprint });

      const { data } = await api.post('/api/auth/resend-verify-device', {
        usernameOrEmail,
        fingerprint
      });

      set({
        isLoading: false,
        requiresDeviceVerification: true,
        pendingUsernameOrEmail: usernameOrEmail
      });

      return {
        success: true,
        message: data.message || 'Device verification code resent successfully',
        requiresDeviceVerification: true
      };
    } catch (error: any) {
      console.error('resendVerifyDevice: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });

      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend device verification code'
      };
    }
  },

  verifyEmail: async (code: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('verifyEmail: Attempt', { code: '[REDACTED]' });

      const { data } = await api.post('/api/auth/verify-email', { code });

      set({
        isLoading: false,
        requiresEmailVerification: false,
        pendingUsernameOrEmail: null,
      });

      return {
        success: true,
        message: data.message || 'Email verified successfully',
        verified: data.verified
      };
    } catch (error: any) {
      console.error('verifyEmail: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });

      set({
        isLoading: false,
        requiresEmailVerification: true
      });

      return {
        success: false,
        message: error.response?.data?.message || 'Email verification failed'
      };
    }
  },

  resendVerifyEmail: async (usernameOrEmail: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('resendVerifyEmail: Attempt', { usernameOrEmail });
      const { data } = await api.post('/api/auth/resend-verify-email', { usernameOrEmail });

      set({
        isLoading: false,
        requiresEmailVerification: true,
        pendingUsernameOrEmail: usernameOrEmail
      });

      return {
        success: data.success !== false,
        message: data.message || 'Verification email resent successfully',
        requiresEmailVerification: data.requiresEmailVerification,
        email: data.email
      };
    } catch (error: any) {
      console.error('resendVerifyEmail: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend verification email',
        action: error.response?.data?.action
      };
    }
  },

  requestPasswordReset: async (email: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('requestPasswordReset: Attempt', { email });
      const { data } = await api.post('/api/auth/request-password-reset', { email });
      set({ isLoading: false });
      return {
        success: true,
        message: data.message || 'Password reset email sent'
      };
    } catch (error: any) {
      console.error('requestPasswordReset: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send password reset email'
      };
    }
  },

  verifyResetToken: async (token: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('verifyResetToken: Attempt', { token: '[REDACTED]' });
      const { data } = await api.get(`/api/auth/verify-reset-token/${token}`);
      set({ isLoading: false });
      return {
        success: true,
        message: data.message || 'Reset token is valid'
      };
    } catch (error: any) {
      console.error('verifyResetToken: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid or expired reset token'
      };
    }
  },

  resetPassword: async (email: string, newPassword: string, confirmPassword: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('resetPassword: Attempt', {
        email,
        newPassword: '[REDACTED]',
        confirmPassword: '[REDACTED]'
      });

      const { data } = await api.post('/api/auth/reset-password', {
        email,
        newPassword,
        confirmPassword
      });

      set({ isLoading: false });
      return {
        success: true,
        message: data.message || 'Password reset successfully'
      };
    } catch (error: any) {
      console.error('resetPassword: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password'
      };
    }
  },

  logout: async () => {
    console.log('🚪 PRODUCTION LOGOUT - Starting');
    const logoutId = `logout_${Date.now()}`;

    try {
      const currentState = {
        isAuthenticated: get().isAuthenticated,
        hasUser: !!get().user,
        hasAccessToken: !!get().accessToken,
        hasRefreshToken: !!await SecureStore.getItemAsync('refreshToken'),
        hasCsrfToken: !!get().csrfToken,
      };

      console.log(`📊 ${logoutId} - Initial state:`, currentState);
      set({ isLoading: true });

      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const csrfToken = get().csrfToken;

      if (refreshToken && csrfToken) {
        console.log(`🌐 ${logoutId} - Calling logout API`);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`⏱️ ${logoutId} - Logout API timeout`);
          }, 5000);

          await api.post('/api/auth/logout',
            { refreshToken },
            {
              headers: {
                'X-CSRF-Token': csrfToken,
                'Content-Type': 'application/json'
              },
              signal: controller.signal,
              validateStatus: (status) => {
                return status === 200 || status === 401 || status === 400;
              }
            }
          );

          clearTimeout(timeoutId);
          console.log(`✅ ${logoutId} - Logout API completed`);

        } catch (apiError: any) {
          if (apiError.name === 'AbortError' || apiError.code === 'ECONNABORTED') {
            console.log(`⚠️ ${logoutId} - Logout API timeout (expected during logout)`);
          } else if (apiError.response?.status === 401) {
            console.log(`ℹ️ ${logoutId} - Token already invalid (expected)`);
          } else {
            console.warn(`⚠️ ${logoutId} - Logout API error:`, {
              status: apiError.response?.status,
              message: apiError.message?.substring(0, 100)
            });
          }
        }
      } else {
        console.log(`ℹ️ ${logoutId} - Skipping API call (missing tokens)`);
      }

    } catch (error: any) {
      console.error(`❌ ${logoutId} - Unexpected error:`, {
        message: error.message?.substring(0, 200)
      });
    } finally {
      console.log(`🧹 ${logoutId} - Performing final cleanup`);

      try {
        await Promise.all([
          SecureStore.deleteItemAsync('refreshToken'),
          SecureStore.deleteItemAsync('accessToken'),
          SecureStore.deleteItemAsync('deviceId'),
        ]);
        console.log(`🔐 ${logoutId} - Secure storage cleared`);
      } catch (storageError: any) {
        console.warn(`⚠️ ${logoutId} - Storage cleanup warning:`, {
          message: storageError.message
        });
      }

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        csrfToken: null,
        isAuthenticated: false,
        fingerprint: null,
        requiresOtp: false,
        requiresEmailVerification: false,
        requiresDeviceVerification: false,
        requiresTOTPSetup: false,
        requiresTOTPCode: false,
        pendingUsernameOrEmail: null,
        isLoading: false,
      });

      console.log(`✅ ${logoutId} - Logout completed successfully`);
    }
  },

  refresh: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const { fingerprint, csrfToken } = get();

      if (!refreshToken || !fingerprint || !csrfToken) {
        console.warn('🔄 Refresh: Missing tokens, cannot refresh');
        return false;
      }

      set({ isLoading: true });

      try {
        console.log('🔄 Refresh: Attempting token refresh');
        const { data } = await api.post('/api/auth/refresh-token',
          { refreshToken, fingerprint },
          {
            headers: { 'X-CSRF-Token': csrfToken },
            timeout: 10000
          }
        );

        await get().setTokens(data.accessToken, data.refreshToken, data.csrfToken);
        console.log('✅ Refresh: Successful');
        set({ isLoading: false, isAuthenticated: true });
        return true;
      } catch (error: any) {
        console.error('❌ Refresh: Failed', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });

        await get().logout();
        return false;
      }
    } catch (error: any) {
      console.error('❌ Refresh: Unexpected error', { message: error.message });
      return false;
    }
  },

  setupTOTP: async (): Promise<TOTPSetupResponse> => {
    set({ isLoading: true });
    try {
      console.log('setupTOTP: Starting TOTP setup (in-app)');

      const { data } = await api.post('/api/auth/setup-totp');

      console.log('setupTOTP: Success', {
        hasSecret: !!data.secret
      });

      set({ isLoading: false });

      return {
        success: true,
        secret: data.secret,
        message: data.message || 'TOTP setup initiated successfully'
      };
    } catch (error: any) {
      console.error('setupTOTP: Error', error);
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to setup TOTP'
      };
    }
  },

  setupTOTPLogin: async (usernameOrEmail: string): Promise<TOTPSetupResponse> => {
    set({ isLoading: true });
    try {
      const fingerprint = get().fingerprint;
      if (!fingerprint) {
        const fingerprintResult = await get().generateFingerprint();
        set({ fingerprint: fingerprintResult.fingerprint });
      }

      console.log('setupTOTPLogin: Starting TOTP setup during login', {
        usernameOrEmail,
        fingerprint: get().fingerprint
      });

      const { data } = await api.post('/api/auth/setup-totp-login', {
        usernameOrEmail,
        fingerprint: get().fingerprint
      });

      if (data.requiresDeviceVerification) {
        console.log('setupTOTPLogin: Device verification required');
        set({
          isLoading: false,
          requiresDeviceVerification: true,
          pendingUsernameOrEmail: usernameOrEmail
        });
        return {
          success: false,
          message: data.message || 'Device verification required first'
        };
      }

      console.log('setupTOTPLogin: Success', {
        hasSecret: !!data.secret
      });

      set({ isLoading: false });

      return {
        success: true,
        secret: data.secret,
        message: data.message || 'TOTP setup initiated successfully'
      };
    } catch (error: any) {
      console.error('setupTOTPLogin: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to setup TOTP during login'
      };
    }
  },

  verifyTOTPSetup: async (totpCode: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('verifyTOTPSetup: Verifying TOTP code for in-app setup', {
        totpCode: '[REDACTED]'
      });

      const { data } = await api.post('/api/auth/verify-totp-setup', { totpCode });

      console.log('verifyTOTPSetup: Response', {
        success: data.success
      });

      const currentUser = get().user;
      if (currentUser && data.success) {
        set({
          user: {
            ...currentUser,
            twoFactorEnabled: true
          }
        });
      }

      set({ isLoading: false });

      return {
        success: true,
        message: data.message || 'TOTP setup completed successfully',
        twoFactorEnabled: data.twoFactorEnabled
      };
    } catch (error: any) {
      console.error('verifyTOTPSetup: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid TOTP code'
      };
    }
  },

  verifyTOTPSetupLogin: async (totpCode: string, usernameOrEmail: string, fingerprint: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('verifyTOTPSetupLogin: Verifying TOTP during login', {
        totpCode: '[REDACTED]',
        usernameOrEmail,
        fingerprint
      });

      const { data } = await api.post('/api/auth/verify-totp-setup-login', {
        totpCode,
        usernameOrEmail,
        fingerprint
      });

      console.log('verifyTOTPSetupLogin: Response', {
        success: data.success,
        hasTokens: !!data.accessToken
      });

      if (data.accessToken) {
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken,
          isAuthenticated: true,
          isLoading: false,
          requiresOtp: false,
          requiresEmailVerification: false,
          requiresDeviceVerification: false,
          requiresTOTPSetup: false,
          requiresTOTPCode: false,
          pendingUsernameOrEmail: null,
        });

        await get().setTokens(data.accessToken, data.refreshToken, data.csrfToken);
      } else {
        set({ isLoading: false });
      }

      return {
        success: true,
        message: data.message || 'TOTP setup completed successfully',
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        twoFactorEnabled: data.twoFactorEnabled
      };
    } catch (error: any) {
      console.error('verifyTOTPSetupLogin: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid TOTP code'
      };
    }
  },

  verifyTOTPLogin: async (code: string, usernameOrEmail: string, fingerprint: string): Promise<AuthResponse> => {
    set({ isLoading: true });
    try {
      console.log('verifyTOTPLogin: Verifying authentication code during login', {
        code: '[REDACTED]',
        usernameOrEmail,
        fingerprint
      });

      const { data } = await api.post('/api/auth/verify-totp-login', {
        code,
        usernameOrEmail,
        fingerprint
      });

      console.log('verifyTOTPLogin: Response', {
        success: data.success,
        hasTokens: !!data.accessToken,
        usedBackupCode: data.usedBackupCode,
        backupCodesRemaining: data.backupCodesRemaining
      });

      if (data.success && data.accessToken) {
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken,
          isAuthenticated: true,
          isLoading: false,
          requiresOtp: false,
          requiresEmailVerification: false,
          requiresDeviceVerification: false,
          requiresTOTPSetup: false,
          requiresTOTPCode: false,
          pendingUsernameOrEmail: null,
        });

        await get().setTokens(data.accessToken, data.refreshToken, data.csrfToken);

        return {
          success: true,
          message: data.message || 'Login successful',
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken,
          backupCodesRemaining: data.backupCodesRemaining,
          usedBackupCode: data.usedBackupCode,
          warningMessage: data.warningMessage,
          twoFactorEnabled: data.twoFactorEnabled
        };
      } else {
        set({ isLoading: false });
        return {
          success: false,
          message: data.message || 'Invalid authentication code'
        };
      }
    } catch (error: any) {
      console.error('verifyTOTPLogin: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });
      set({ isLoading: false });
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to verify authentication code'
      };
    }
  },

  disableTOTP: async (password: string): Promise<DisableTOTPResponse> => {
    set({ isLoading: true });
    try {
      console.log('disableTOTP: Attempting to disable TOTP');

      const { data } = await api.post('/api/auth/disable-totp', {
        password
      });

      console.log('disableTOTP: Success', {
        success: data.success,
        twoFactorEnabled: data.twoFactorEnabled
      });

      if (data.success && data.twoFactorEnabled === false) {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              twoFactorEnabled: false
            }
          });
        }
      }

      set({ isLoading: false });

      return {
        success: data.success,
        message: data.message || 'TOTP disabled successfully',
        twoFactorEnabled: data.twoFactorEnabled
      };
    } catch (error: any) {
      console.error('disableTOTP: Error', {
        status: error.response?.status,
        message: error.response?.data?.message,
        error: error.message,
      });

      set({ isLoading: false });

      return {
        success: false,
        message: error.response?.data?.message || 'Failed to disable TOTP'
      };
    }
  }
}));

// Give authApi access to the store (see connectAuthStore in apis/authApi.ts)
connectAuthStore(useAuthStore);
