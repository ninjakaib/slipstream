/**
 * OnboardingDraftContext — holds everything collected across the onboarding
 * steps and persists it to the API in one place when the flow finishes.
 *
 * Lives in the (onboarding) group layout so all steps share one draft.
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
import {
  createCar,
  getMyProfile,
  updateMyProfile,
} from "@/lib/api/sdk.gen";
import type { SpeedUnit } from "@/lib/api/types.gen";
import { COUNTRIES, type Country } from "@/features/onboarding/lib/countries";

export type VehicleKind = "car" | "bike";

export interface VehicleDraft {
  /** Local-only id for list keys/removal. */
  id: string;
  kind: VehicleKind;
  year: number;
  make: string;
  model: string;
  /** Device-local photo uri (best-effort; not uploaded to a server). */
  photoUri?: string;
}

interface OnboardingDraft {
  displayName: string;
  username: string;
  country: Country;
  phoneNumber: string;
  vehicles: VehicleDraft[];
  speedUnit: SpeedUnit;
}

interface OnboardingDraftContextValue {
  draft: OnboardingDraft;
  /** The user's current server username, for "is this unchanged?" checks. */
  currentUsername: string;
  setDisplayName: (v: string) => void;
  setUsername: (v: string) => void;
  setCountry: (c: Country) => void;
  setPhoneNumber: (v: string) => void;
  addVehicle: (v: Omit<VehicleDraft, "id">) => void;
  removeVehicle: (id: string) => void;
  setSpeedUnit: (u: SpeedUnit) => void;
  /** Persist everything to the API. Throws on failure. */
  submit: () => Promise<void>;
}

const OnboardingDraftContext =
  createContext<OnboardingDraftContextValue | null>(null);

let vehicleSeq = 0;
const nextVehicleId = () => `v${++vehicleSeq}`;

/** Apple sign-in assigns a throwaway "user_xxxx" handle we shouldn't prefill. */
function isTempUsername(username: string): boolean {
  return /^user_[0-9a-f]{4,}$/i.test(username);
}

export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const currentUsername = session?.username ?? "";

  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    displayName: "",
    username: isTempUsername(currentUsername) ? "" : currentUsername,
    country: COUNTRIES[0],
    phoneNumber: "",
    vehicles: [],
    speedUnit: "mph",
  }));

  // Prefill from the server profile (Apple may have provided a display name).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMyProfile();
        if (cancelled || !data) return;
        setDraft((d) => ({
          ...d,
          displayName: d.displayName || data.display_name || "",
          username:
            d.username ||
            (data.username && !isTempUsername(data.username)
              ? data.username
              : ""),
          phoneNumber: d.phoneNumber || data.phone_number || "",
          speedUnit: data.speed_unit ?? d.speedUnit,
        }));
      } catch {
        // Non-fatal — start with empty fields.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDisplayName = useCallback(
    (v: string) => setDraft((d) => ({ ...d, displayName: v })),
    [],
  );
  const setUsername = useCallback(
    (v: string) => setDraft((d) => ({ ...d, username: v })),
    [],
  );
  const setCountry = useCallback(
    (c: Country) => setDraft((d) => ({ ...d, country: c })),
    [],
  );
  const setPhoneNumber = useCallback(
    (v: string) => setDraft((d) => ({ ...d, phoneNumber: v })),
    [],
  );
  const addVehicle = useCallback(
    (v: Omit<VehicleDraft, "id">) =>
      setDraft((d) => ({
        ...d,
        vehicles: [...d.vehicles, { ...v, id: nextVehicleId() }],
      })),
    [],
  );
  const removeVehicle = useCallback(
    (id: string) =>
      setDraft((d) => ({
        ...d,
        vehicles: d.vehicles.filter((v) => v.id !== id),
      })),
    [],
  );
  const setSpeedUnit = useCallback(
    (u: SpeedUnit) => setDraft((d) => ({ ...d, speedUnit: u })),
    [],
  );

  const submit = useCallback(async () => {
    const trimmedUsername = draft.username.trim();
    const usernameChanged =
      trimmedUsername.length > 0 &&
      trimmedUsername.toLowerCase() !== currentUsername.toLowerCase();

    const e164 = draft.phoneNumber.trim()
      ? `${draft.country.dial}${draft.phoneNumber.replace(/[^\d]/g, "")}`
      : undefined;

    const { error } = await updateMyProfile({
      body: {
        display_name: draft.displayName.trim() || undefined,
        username: usernameChanged ? trimmedUsername : undefined,
        phone_number: e164,
        speed_unit: draft.speedUnit,
      },
    });

    if (error) {
      const detail = (error as { detail?: string }).detail;
      throw new Error(detail ?? "Couldn't save your profile. Try again.");
    }

    // First created vehicle auto-activates server-side.
    for (const v of draft.vehicles) {
      const { error: carError } = await createCar({
        body: {
          year: v.year,
          make: v.make.trim(),
          model: v.model.trim(),
          color: "Unknown",
          display_name: `${v.year} ${v.make}`.trim() || undefined,
          photo_url: v.photoUri,
        },
      });
      if (carError) {
        const detail = (carError as { detail?: string }).detail;
        throw new Error(detail ?? "Couldn't save your vehicle. Try again.");
      }
    }
  }, [draft, currentUsername]);

  const value = useMemo<OnboardingDraftContextValue>(
    () => ({
      draft,
      currentUsername,
      setDisplayName,
      setUsername,
      setCountry,
      setPhoneNumber,
      addVehicle,
      removeVehicle,
      setSpeedUnit,
      submit,
    }),
    [
      draft,
      currentUsername,
      setDisplayName,
      setUsername,
      setCountry,
      setPhoneNumber,
      addVehicle,
      removeVehicle,
      setSpeedUnit,
      submit,
    ],
  );

  return (
    <OnboardingDraftContext.Provider value={value}>
      {children}
    </OnboardingDraftContext.Provider>
  );
}

export function useOnboardingDraft(): OnboardingDraftContextValue {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx)
    throw new Error(
      "useOnboardingDraft must be used within OnboardingDraftProvider",
    );
  return ctx;
}
