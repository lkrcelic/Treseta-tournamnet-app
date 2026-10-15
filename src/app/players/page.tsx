"use client";

import useAdminPhone from "@/app/_hooks/useAdminPhone";
import {PlayersDirectoryPhone} from "@/app/_ui/admin/DirectoryPhone";
import {AdminIndex} from "@/app/_ui/profiles/Directory";

// Igrači (admin; the nav drawer's "Igrači"): on the desktop the directory opens the first player in it; an admin's
// phone gets its own Igrači list (DECISIONS #59). Players get Početna.
export default function PlayersRoute() {
  const adminPhone = useAdminPhone();
  return adminPhone ? <PlayersDirectoryPhone /> : <AdminIndex kind="players" />;
}
