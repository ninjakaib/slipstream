/**
 * Onboarding completion is tracked locally on-device (per the product
 * decision to avoid a server-side flag). We key the flag by user id so that
 * signing into a different account on the same device is evaluated
 * independently.
 */
import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "slipstream_onboarded_";

function keyFor(userId: string): string {
  // SecureStore keys must match [A-Za-z0-9._-]; user ids are UUIDs (safe).
  return `${KEY_PREFIX}${userId}`;
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(keyFor(userId));
    return value === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await SecureStore.setItemAsync(keyFor(userId), "1");
}

export async function clearOnboarding(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(keyFor(userId));
  } catch {
    // ignore — nothing to clear
  }
}
