"use client";

import type {Capability} from "@/app/_lib/auth/permissions";
import useAuthStore, {userCan} from "@/app/_store/authStore";

/**
 * Whether the logged-in player may do this, from the stored user (/api/auth/me fills `can` on every app load), so the
 * screens show right away instead of after a request. False when logged out.
 *
 * This is the client's only question about rights: not "is this an admin" but "may this player do X" (DECISIONS #86).
 * A new role changes nothing here. Only hides or shows UI — every endpoint checks the same map on the server.
 */
export default function useCan(cap: Capability): boolean {
  return useAuthStore((s) => userCan(s.user, cap));
}

// Whether the player manages anything at all, so the management screens and the Admin menu are theirs. What they may
// do inside is still each `useCan`.
export function useManages(): boolean {
  return useAuthStore((s) => userCan(s.user));
}

// The player's role, for the label on their profile
export function useRole() {
  return useAuthStore((s) => s.user?.role);
}
