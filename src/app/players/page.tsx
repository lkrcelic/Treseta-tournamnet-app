"use client";

import {PlayersDirectoryPhone} from "@/app/_ui/admin/DirectoryPhone";
import {AdminIndex} from "@/app/_ui/profiles/Directory";
import useManagePhone from "@/app/_hooks/useManagePhone";

// Igrači (admin; the nav drawer's "Igrači"): on the desktop the directory opens the first player in it; an admin's
// phone gets its own Igrači list (DECISIONS #59). Players get Početna.
export default function PlayersRoute() {
  const adminPhone = useManagePhone("player.directory");
  return adminPhone ? <PlayersDirectoryPhone /> : <AdminIndex kind="players" />;
}
