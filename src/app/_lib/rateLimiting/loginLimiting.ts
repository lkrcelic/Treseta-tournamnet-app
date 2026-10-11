import {NextRequest} from "next/server";

/*
 * TODO: In the future, we might want to consider using Redis for this (for scalability)
 * I did not do it now as it requires either setting up to run locally on our server
 * OR we could consider hosted(paid) redis options.
 */

// Only failed logins count: after MAX_FAILURES wrong passwords within WINDOW_DURATION the account is locked
// for the rest of the window. Every attempt is recorded before the password check and a successful login clears
// the count, so a player on several devices is never locked.
export const MAX_FAILURES = 5;
export const WINDOW_DURATION = 5 * 60 * 1000; // Minutes * seconds * miliseconds

type Entry = {count: number; firstFailure: number};
const failureStore = new Map<string, Entry>();

// Per address and account, so someone else can't lock a player out by failing logins with their username.
// The address comes from the proxy's X-Forwarded-For when the platform doesn't give one.
export function loginLimitKey(request: NextRequest, account: string): string {
  const ip = request.ip || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${ip}|${account}`;
}

export function isLoginLocked(key: string, now = Date.now()): boolean {
  const entry = failureStore.get(key);
  if (!entry) return false;
  if (now - entry.firstFailure > WINDOW_DURATION) {
    failureStore.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailedLogin(key: string, now = Date.now()): void {
  pruneExpired(now);
  const entry = failureStore.get(key);
  if (!entry || now - entry.firstFailure > WINDOW_DURATION) {
    failureStore.set(key, {count: 1, firstFailure: now});
  } else {
    entry.count++;
  }
}

export function clearFailedLogins(key: string): void {
  failureStore.delete(key);
}

// The store lives in memory, so drop entries whose window is over to keep it from growing forever
function pruneExpired(now: number) {
  if (failureStore.size < 1000) return;
  failureStore.forEach((entry, key) => {
    if (now - entry.firstFailure > WINDOW_DURATION) failureStore.delete(key);
  });
}
