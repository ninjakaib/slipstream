/**
 * Auth service — token storage, refresh, and session management.
 *
 * Stores tokens in expo-secure-store (iOS Keychain / Android Keystore).
 * Handles silent refresh on app launch and provides an interceptor
 * for attaching the access token to API requests.
 */
import * as SecureStore from "expo-secure-store";
// Use whatwg-fetch directly — Expo's custom fetch override (ExpoFetchModule)
// crashes on Hermes because the native module isn't compiled in.
// whatwg-fetch is RN's base fetch polyfill and handles string bodies correctly.
// @ts-ignore — no types for whatwg-fetch
import { fetch as whatwgFetch } from "whatwg-fetch";

import { client } from "@/lib/api/client.gen";
import { refresh as refreshTokens } from "@/lib/api/sdk.gen";

const ACCESS_TOKEN_KEY = "slipstream_access_token";
const REFRESH_TOKEN_KEY = "slipstream_refresh_token";
const USER_ID_KEY = "slipstream_user_id";
const USERNAME_KEY = "slipstream_username";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_ID_KEY, session.userId),
    SecureStore.setItemAsync(USERNAME_KEY, session.username),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, userId, username] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(USERNAME_KEY),
  ]);

  if (!accessToken || !refreshToken || !userId || !username) {
    return null;
  }

  return { accessToken, refreshToken, userId, username };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(USERNAME_KEY),
  ]);
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new session on success, or null if refresh failed (user must re-login).
 */
export async function attemptTokenRefresh(): Promise<StoredSession | null> {
  const stored = await loadSession();
  if (!stored) return null;

  const { data, error } = await refreshTokens({
    body: { refresh_token: stored.refreshToken },
  });

  if (error || !data) {
    await clearSession();
    return null;
  }

  const newSession: StoredSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user_id,
    username: data.username,
  };

  await saveSession(newSession);
  return newSession;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

let currentToken: string | null = null;

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Set or clear the auth token used by API requests.
 */
export function configureClient(accessToken?: string): void {
  currentToken = accessToken || null;
}

// One-time client setup — use whatwg-fetch to bypass Expo's broken native fetch
console.log("[Auth] configuring client baseUrl:", BASE_URL);

client.setConfig({
  baseUrl: BASE_URL,
  fetch: whatwgFetch as unknown as typeof globalThis.fetch,
});

// Attach auth header via interceptor
client.interceptors.request.use((request) => {
  if (currentToken) {
    request.headers.set("Authorization", `Bearer ${currentToken}`);
  }
  console.log("[Auth] outgoing request:", request.method, request.url);
  return request;
});
