import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import type { useAuthStore } from "../store/authStore";
import { loadRefreshToken } from "../config/tokenApi";
import axiosRetry from 'axios-retry';

// authStore imports this file, so this file must not import authStore back (that loop is a
// "require cycle"). Instead the store hands itself over by calling connectAuthStore() once
// it is created. `import type` above is only for TypeScript and disappears when the app runs.
let authStore: typeof useAuthStore | null = null;

export function connectAuthStore(store: typeof useAuthStore) {
  authStore = store;
}

function getAuthStore() {
  if (!authStore) throw new Error("authApi was used before connectAuthStore() was called");
  return authStore;
}

// The server gives out a new refresh token on every refresh and retires the old one. So two
// refreshes at the same moment (e.g. the startup login check and a request that got a 401) would
// make the second one fail and log the user out. Everyone shares this one in-flight refresh.
let refreshInFlight: Promise<{ accessToken: string; csrfToken: string }> | null = null;

/** Gets new tokens from the server (once, however many callers ask at the same time) and saves them. */
export function refreshTokensOnce(): Promise<{ accessToken: string; csrfToken: string }> {
  refreshInFlight ??= (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) throw new Error("No refresh token available");
    const { fingerprint, csrfToken } = getAuthStore().getState();
    if (!fingerprint) throw new Error("Device fingerprint missing");
    if (!csrfToken) throw new Error("CSRF token missing");

    const { data } = await axios.post(
      `${API_URL}/api/auth/refresh-token`,
      { refreshToken, fingerprint },
      { headers: { "X-CSRF-Token": csrfToken, "Content-Type": "application/json" }, timeout: 10000 }
    );
    await getAuthStore().getState().setTokens(data.accessToken, data.refreshToken, data.csrfToken);
    return { accessToken: data.accessToken as string, csrfToken: data.csrfToken as string };
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${new Date().toISOString()} ${message}`, meta || ""),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${new Date().toISOString()} ${message}`, meta || ""),
};

// Set in apps/mobile/.env (see .env.example). Expo only exposes variables starting with EXPO_PUBLIC_.
const API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in apps/mobile/.env (see apps/mobile/.env.example)");
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

axiosRetry(api, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 2000,
  retryCondition: (error) => error.message === 'Network Error' || !error.response,
  onRetry: (retryCount, error, requestConfig) => {
    logger.info(`Retry attempt ${retryCount} for ${requestConfig.url}`, {
      error: error.message
    });
  }
});

let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

function processQueue(error: any, token: string | null = null) {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
  isRefreshing = false;
}

// ========== REQUEST INTERCEPTOR ==========
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Skip logging for logout requests to reduce noise
    if (!config.url?.includes('/api/auth/logout')) {
      // No headers in the log: they hold the login token
      console.log('🚀 Sending request:', { method: config.method, url: config.url });
    }

    const { accessToken, csrfToken } = getAuthStore().getState();

    // Add Authorization header if we have access token
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token for state-changing operations
    if (csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(config.method?.toUpperCase() || "")) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }

    logger.info(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
      hasAuth: !!accessToken,
      hasCsrf: !!csrfToken,
    });

    return config;
  },
  (error) => {
    logger.error("Request interceptor error", { error: error.message });
    return Promise.reject(error);
  }
);

// ========== RESPONSE INTERCEPTOR ==========
api.interceptors.response.use(
  (response) => {
    // Log successful responses (optional)
    if (!response.config.url?.includes('/api/auth/logout')) {
      logger.info(`Response ${response.status}: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest?.url || 'unknown';

    // ========== SPECIAL HANDLING FOR LOGOUT ==========
    if (url.includes('/api/auth/logout')) {
      logger.info("Logout request failed - this is expected during logout flow");
      // Always reject logout errors - they're handled by the logout function
      return Promise.reject(error);
    }

    // ========== RATE LIMITING ==========
    if (error.response?.status === 429) {
      const errorMessage = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data
        ? (error.response.data as any).message
        : "Too many requests, please try again later";

      // A warning, not an error: it's a temporary "slow down", and the next request usually works
      console.warn("Rate limit reached", {
        url,
        message: errorMessage,
      });

      return Promise.reject(new Error(errorMessage));
    }

    // ========== TOKEN REFRESH LOGIC ==========
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      // Check if we're already in a logout process
      const { isAuthenticated } = getAuthStore().getState();
      if (!isAuthenticated) {
        logger.info("Skipping refresh - user is not authenticated");
        return Promise.reject(error);
      }

      // Handle concurrent refresh requests
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((newToken) => {
            if (!newToken) {
              // Usually a temporary server/network problem; a real login problem logs out below
              console.warn("Refresh failed in queue", { url });
              reject(new Error("Session expired, please log in again"));
            } else {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              resolve(api(originalRequest));
            }
          });
        });
      }

      isRefreshing = true;
      logger.info("Attempting token refresh", { url });

      try {
        // Shared with the store's own refresh, so the two never race (see refreshTokensOnce)
        const data = await refreshTokensOnce();

        logger.info("Token refresh successful", { url });

        // 6. Process queued requests
        processQueue(null, data.accessToken);

        // 7. Retry original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          originalRequest.headers["X-CSRF-Token"] = data.csrfToken;
        }

        return api(originalRequest);

      } catch (refreshError: any) {
        // A warning, not a red error: the app handles it (logs out only on 401, otherwise retries)
        console.warn("Token refresh failed", {
          url,
          status: refreshError.response?.status,
          error: refreshError.message,
        });

        // Clear the queue with error
        processQueue(refreshError, null);

        // Only logout if it's an authentication error (not network error)
        if (refreshError.response?.status === 401 ||
          refreshError.message?.includes("No refresh token") ||
          refreshError.message?.includes("Invalid refresh token")) {

          logger.info("Initiating logout due to failed refresh", { url });

          // Use a timeout to prevent blocking
          setTimeout(() => {
            getAuthStore().getState().logout().catch(err => {
              logger.error("Logout after refresh failed", { error: err.message });
            });
          }, 100);
        }

        return Promise.reject(new Error("Session expired, please log in again"));
      }
    }

    // ========== GENERAL ERROR HANDLING ==========
    const errorMessage = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data
      ? (error.response.data as any).message
      : error.message || "Unknown error";

    // Don't log 401 errors for logout endpoint
    if (!(error.response?.status === 401 && url.includes('/api/auth/logout'))) {
      const details = { status: error.response?.status, url, method: originalRequest?.method, message: errorMessage };
      // The screens handle failed requests themselves (a message, "Not available", a retry), so most
      // failures are only worth a quiet warning: no connection, server restarting (502/503/504),
      // or the server saying no (4xx, e.g. a trade refused by the risk checks). Only a crash on the
      // server (500) shows as a red error in development.
      if (error.response?.status === 500) logger.error("API request failed", details);
      else console.warn("API request failed", details);
    }

    return Promise.reject(error);
  }
);

export default api;