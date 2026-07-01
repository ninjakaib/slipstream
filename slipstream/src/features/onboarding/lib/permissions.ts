/**
 * Thin wrappers around the native permission requests used on the final
 * onboarding step. Each resolves to `true` when granted and swallows errors
 * (a denied or unavailable permission shouldn't crash onboarding).
 */
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Pedometer } from "expo-sensors";

/**
 * "Always Allow" location. iOS shows "While Using" first, then a separate
 * Always prompt — so we request foreground, then background.
 */
export async function requestLocationAlways(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  } catch {
    return false;
  }
}

/** Motion & Fitness — used to confirm the user is actually in a moving car. */
export async function requestMotion(): Promise<boolean> {
  try {
    const res = await Pedometer.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/** Local/push notification permission. */
export async function requestNotifications(): Promise<boolean> {
  try {
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}
