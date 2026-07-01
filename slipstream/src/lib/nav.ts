/**
 * Navigation helpers.
 *
 * Expo Router's `typedRoutes` experiment narrows `Href` to a union of the
 * routes it has discovered. That union is regenerated when the dev server
 * runs, so freshly-added routes won't be in it during a static typecheck.
 * These wrappers accept a plain `string` and downcast to `Href` — a `string`
 * is a supertype of the route union, so the assertion stays valid before and
 * after Expo regenerates `.expo/types`.
 */
import { router, type Href } from "expo-router";

export function navPush(path: string) {
  return router.push(path as Href);
}

export function navReplace(path: string) {
  return router.replace(path as Href);
}

export function navBack() {
  if (router.canGoBack()) {
    router.back();
  }
}

/** Route path constants for the onboarding flow, in order. */
export const ONBOARDING_ROUTES = {
  intro: "/(onboarding)/intro",
  name: "/(onboarding)/name",
  username: "/(onboarding)/username",
  phone: "/(onboarding)/phone",
  vehicle: "/(onboarding)/vehicle",
  units: "/(onboarding)/units",
  permissions: "/(onboarding)/permissions",
} as const;

export const AUTH_ROUTES = {
  welcome: "/(auth)/welcome",
  login: "/(auth)/login",
} as const;
