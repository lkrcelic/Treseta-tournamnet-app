"use client";

import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useAdminViewStore from "@/app/_store/adminViewStore";

// Whether a page shows the admin's phone screens (Claude Design "Admin mobilni ekrani"): an admin, below the desktop
// width, who hasn't switched to "Prikaz igrača". Only picks the layout: every admin endpoint checks the role on the
// server.
export default function useAdminPhone(): boolean {
  const isAdmin = useIsAdmin();
  const isDesktop = useIsDesktop();
  const view = useAdminViewStore((s) => s.view);
  return isAdmin && !isDesktop && view === "admin";
}
