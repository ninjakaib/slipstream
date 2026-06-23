/**
 * AuthContext — provides auth state and actions to the app tree.
 *
 * On mount, attempts to restore a session from secure storage.
 * If the access token is expired, silently refreshes using the stored
 * refresh token. Exposes login, register, and logout actions.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { login as apiLogin, register as apiRegister } from "@/lib/api/sdk.gen";
import {
  attemptTokenRefresh,
  clearSession,
  configureClient,
  loadSession,
  saveSession,
  type StoredSession,
} from "@/lib/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: StoredSession | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<StoredSession | null>(null);

  // Bootstrap: try to restore session on app launch
  useEffect(() => {
    (async () => {
      const stored = await loadSession();
      if (!stored) {
        setStatus("unauthenticated");
        return;
      }

      // Configure client with existing token optimistically
      configureClient(stored.accessToken);
      setSession(stored);
      setStatus("authenticated");

      // Attempt background refresh to extend the session
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        configureClient(refreshed.accessToken);
        setSession(refreshed);
      } else {
        // Refresh failed — token pair is invalid, force re-login
        setSession(null);
        setStatus("unauthenticated");
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    console.log("[Auth] login attempt", { username, baseUrl: process.env.EXPO_PUBLIC_API_URL });

    const { data, error, response } = await apiLogin({
      body: { username, password },
    });

    console.log("[Auth] login response", {
      status: response?.status,
      ok: response?.ok,
      data,
      error,
    });

    if (error || !data) {
      const err = error as { detail?: string | Array<{ msg: string }> };
      const message = Array.isArray(err?.detail)
        ? err.detail.map((d) => d.msg).join(", ")
        : err?.detail ?? "Login failed";
      throw new Error(message);
    }

    const newSession: StoredSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user_id,
      username: data.username,
    };

    await saveSession(newSession);
    configureClient(newSession.accessToken);
    setSession(newSession);
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const { data, error } = await apiRegister({
        body: {
          username,
          password,
          display_name: displayName || undefined,
        },
      });

      if (error || !data) {
        throw new Error(
          (error as { detail?: string })?.detail ?? "Registration failed",
        );
      }

      const newSession: StoredSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        userId: data.user_id,
        username: data.username,
      };

      await saveSession(newSession);
      configureClient(newSession.accessToken);
      setSession(newSession);
      setStatus("authenticated");
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, session, login, register, logout }),
    [status, session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
