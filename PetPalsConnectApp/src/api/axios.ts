import axios, { type InternalAxiosRequestConfig } from "axios";
import { getAuth } from "@react-native-firebase/auth";

import { API_URL } from "../config/env";

/**
 * Shared API client.
 *
 * The previous version read `localStorage`, which does not exist in React
 * Native, so no request ever carried an Authorization header and every
 * protected endpoint returned 401.
 *
 * Tokens now come straight from the Firebase SDK, which caches them and
 * refreshes automatically when they near expiry. That removes the need to
 * mirror the token into storage ourselves and keeps a single source of truth.
 */
const instance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/** Marks a config we have already replayed, so a 401 loop cannot form. */
type RetriableConfig = InternalAxiosRequestConfig & { __isRetry?: boolean };

instance.interceptors.request.use(async (config: RetriableConfig) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetriableConfig | undefined;
    const response = error.response;

    // A 401 usually means the cached ID token went stale. Force-refresh once
    // and replay the request before surfacing the failure.
    if (response?.status === 401 && config && !config.__isRetry) {
      const user = getAuth().currentUser;
      if (user) {
        config.__isRetry = true;
        config.headers.Authorization = `Bearer ${await user.getIdToken(true)}`;
        return instance(config);
      }
    }

    if (__DEV__ && response) {
      console.warn(
        `[api] ${config?.method?.toUpperCase()} ${config?.url} -> ${response.status}`,
        response.data
      );
    }

    return Promise.reject(error);
  }
);

export default instance;
