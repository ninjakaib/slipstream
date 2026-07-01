/**
 * Onboarding store — holds everything collected across the onboarding steps and
 * persists it to the API in one place when the flow finishes.
 *
 * Replaces the old OnboardingDraftContext. Global (no provider): screens read
 * fields/actions directly, and `(onboarding)/_layout.tsx` calls `hydrate()` once
 * to seed the current username + prefill from the server profile.
 */
import { create } from "zustand";

import { createCar, getMyProfile, updateMyProfile } from "@/lib/api/sdk.gen";
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

interface OnboardingState {
  // Draft fields
  displayName: string;
  username: string;
  country: Country;
  phoneNumber: string;
  vehicles: VehicleDraft[];
  speedUnit: SpeedUnit;
  /** The user's current server username, for "is this unchanged?" checks. */
  currentUsername: string;

  // Field setters
  setDisplayName: (v: string) => void;
  setUsername: (v: string) => void;
  setCountry: (c: Country) => void;
  setPhoneNumber: (v: string) => void;
  addVehicle: (v: Omit<VehicleDraft, "id">) => void;
  removeVehicle: (id: string) => void;
  setSpeedUnit: (u: SpeedUnit) => void;

  /** Seed currentUsername and prefill fields from the server profile. */
  hydrate: (currentUsername: string) => Promise<void>;
  /** Persist everything to the API. Throws on failure. */
  submit: () => Promise<void>;
}

let vehicleSeq = 0;
const nextVehicleId = () => `v${++vehicleSeq}`;

/** Apple sign-in assigns a throwaway "user_xxxx" handle we shouldn't prefill. */
function isTempUsername(username: string): boolean {
  return /^user_[0-9a-f]{4,}$/i.test(username);
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  displayName: "",
  username: "",
  country: COUNTRIES[0],
  phoneNumber: "",
  vehicles: [],
  speedUnit: "mph",
  currentUsername: "",

  setDisplayName: (v) => set({ displayName: v }),
  setUsername: (v) => set({ username: v }),
  setCountry: (c) => set({ country: c }),
  setPhoneNumber: (v) => set({ phoneNumber: v }),
  addVehicle: (v) =>
    set((s) => ({ vehicles: [...s.vehicles, { ...v, id: nextVehicleId() }] })),
  removeVehicle: (id) =>
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),
  setSpeedUnit: (u) => set({ speedUnit: u }),

  hydrate: async (currentUsername) => {
    // Seed the current server username immediately (used by submit's diff check),
    // and default the username field to it unless it's a temp Apple handle.
    set((s) => ({
      currentUsername,
      username:
        s.username ||
        (currentUsername && !isTempUsername(currentUsername)
          ? currentUsername
          : ""),
    }));

    // Prefill from the server profile (Apple may have provided a display name).
    try {
      const { data } = await getMyProfile();
      if (!data) return;
      set((s) => ({
        displayName: s.displayName || data.display_name || "",
        username:
          s.username ||
          (data.username && !isTempUsername(data.username) ? data.username : ""),
        phoneNumber: s.phoneNumber || data.phone_number || "",
        speedUnit: data.speed_unit ?? s.speedUnit,
      }));
    } catch {
      // Non-fatal — start with empty fields.
    }
  },

  submit: async () => {
    const draft = get();
    const { currentUsername } = draft;

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
  },
}));
