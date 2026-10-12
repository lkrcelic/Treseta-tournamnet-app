"use client";

import useAuthStore from "@/app/_store/authStore";

// Whether the logged-in player is an admin, from the stored user (/api/auth/me fills it on every app load), so admin
// layouts show right away instead of after a request. False when logged out. Only hides or shows UI: every admin
// endpoint checks the role on the server.
export default function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.is_admin === true);
}
