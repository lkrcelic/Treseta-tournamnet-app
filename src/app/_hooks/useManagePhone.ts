"use client";

import type {Capability} from "@/app/_lib/auth/permissions";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useAuthStore, {userCan} from "@/app/_store/authStore";
import useAdminViewStore from "@/app/_store/adminViewStore";

/**
 * Whether a page shows the management phone screens (Claude Design "Admin mobilni ekrani"): someone who manages
 * something, below the desktop width, who hasn't switched to "Prikaz igrača".
 *
 * This used to be `useAdminPhone` and meant two things at once — which layout, and whether the player is allowed
 * (DECISIONS #86). They are apart now: this picks the LAYOUT, and `cap` says which screen it is, so a role that may
 * run tournaments doesn't get the league's screens. Pass the capability the screen needs; without one, this is the
 * layout alone. Only picks the layout and hides or shows UI: every endpoint checks the same map on the server.
 */
export default function useManagePhone(cap?: Capability): boolean {
  const allowed = useAuthStore((s) => userCan(s.user, cap));
  const isDesktop = useIsDesktop();
  const view = useAdminViewStore((s) => s.view);
  return allowed && !isDesktop && view === "admin";
}
