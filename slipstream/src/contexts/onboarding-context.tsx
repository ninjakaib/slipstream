/**
 * OnboardingContext — tracks whether the signed-in user still needs to go
 * through onboarding.
 *
 * Completion is stored locally (see `lib/onboarding`). On first evaluation
 * for a user with no local flag we fall back to a heuristic: if their server
 * profile already looks set up (has an active car), we treat onboarding as
 * done so existing accounts aren't forced through it again after a reinstall.
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

import { useAuth } from "@/contexts/auth-context";
import { getMyProfile } from "@/lib/api/sdk.gen";
import { isOnboardingComplete, markOnboardingComplete } from "@/lib/onboarding";

export type OnboardingStatus = "loading" | "needed" | "complete";

interface OnboardingContextValue {
  status: OnboardingStatus;
  /** Persist the local completion flag and flip the gate to the main app. */
  complete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, session } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>("loading");

  const userId = session?.userId ?? null;

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== "authenticated" || !userId) {
      // Re-evaluate from scratch on the next authenticated session.
      setStatus("loading");
      return;
    }

    (async () => {
      if (await isOnboardingComplete(userId)) {
        if (!cancelled) setStatus("complete");
        return;
      }

      try {
        const { data } = await getMyProfile();
        if (cancelled) return;
        if (data?.active_car) {
          await markOnboardingComplete(userId);
          setStatus("complete");
        } else {
          setStatus("needed");
        }
      } catch {
        // Can't confirm setup — run onboarding (the submit step is idempotent
        // enough that a returning user just re-saves their details).
        if (!cancelled) setStatus("needed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, userId]);

  const complete = useCallback(async () => {
    if (userId) await markOnboardingComplete(userId);
    setStatus("complete");
  }, [userId]);

  const value = useMemo(() => ({ status, complete }), [status, complete]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
