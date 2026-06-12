import type { UserType } from "./types";

const KEY = "rivaleye-session-hint";

function defaultStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

// Last known signed-in user, persisted so a page refresh can render the app
// shell immediately while better-auth revalidates the session in the
// background. UI-only optimism — every API call still enforces the cookie.
export function readSessionHint(storage = defaultStorage()): UserType {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as UserType;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSessionHint(
  user: Record<string, unknown>,
  storage = defaultStorage(),
) {
  try {
    storage?.setItem(KEY, JSON.stringify(user));
  } catch {
    // Storage full or unavailable — refresh just falls back to the splash.
  }
}

export function clearSessionHint(storage = defaultStorage()) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
