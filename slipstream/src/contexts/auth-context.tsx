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

import * as AppleAuthentication from "expo-apple-authentication";

import {
  login as apiLogin,
  register as apiRegister,
  authWithApple as apiAuthWithApple,
} from "@/lib/api/sdk.gen";
import {
  attemptTokenRefresh,
  clearSession,
  configureClient,
  loadSession,
  saveSession,
  type StoredSession,
} from "@/lib/auth";
import { useOnboardingStore } from "@/stores/onboarding-store";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: StoredSession | null;
  /** `identifier` is an email or username. */
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<{ isNewUser: boolean } | null>;
  logout: () => Promise<void>;
}

/** Thrown when the user dismisses the native Apple sign-in sheet. */
export class AppleSignInCanceled extends Error {
  constructor() {
    super("Apple sign-in was canceled");
    this.name = "AppleSignInCanceled";
  }
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

  const login = useCallback(async (identifier: string, password: string) => {
    console.log("[Auth] login attempt", { identifier, baseUrl: process.env.EXPO_PUBLIC_API_URL });

    // The backend `username` field accepts an email or a username.
    const { data, error, response } = await apiLogin({
      body: { username: identifier, password },
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

  const register = useCallback(async (email: string, password: string) => {
    // Signup collects only email + password; the backend mints a temp username
    // that onboarding replaces. Display name/username are set during onboarding.
    const { data, error } = await apiRegister({
      body: { email, password },
    });

    if (error || !data) {
      const err = error as { detail?: string | Array<{ msg: string }> };
      const message = Array.isArray(err?.detail)
        ? err.detail.map((d) => d.msg).join(", ")
        : err?.detail ?? "Registration failed";
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

  const signInWithApple = useCallback(async () => {
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") {
        return null; // user backed out of the sheet
      }
      throw e;
    }

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token");
    }

    // Apple only includes fullName/email on the very first authorization for
    // an app, so forward whatever we got — the backend persists it.
    const fullName =
      credential.fullName?.givenName || credential.fullName?.familyName
        ? {
            given_name: credential.fullName?.givenName ?? undefined,
            family_name: credential.fullName?.familyName ?? undefined,
          }
        : undefined;

    const { data, error } = await apiAuthWithApple({
      body: {
        identity_token: credential.identityToken,
        full_name: fullName,
        email: credential.email ?? undefined,
      },
    });

    if (error || !data) {
      throw new Error(
        (error as { detail?: string })?.detail ?? "Apple sign-in failed",
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

    return { isNewUser: data.is_new_user };
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    // Clear any onboarding draft so the next account starts from a clean slate.
    useOnboardingStore.getState().reset();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, session, login, register, signInWithApple, logout }),
    [status, session, login, register, signInWithApple, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
