"use client";

import {AdminIndex} from "@/app/_ui/profiles/Directory";

// Igrači (admin, desktop; the nav drawer's "Igrači"): the directory opens the first player in it. Players get Početna,
// an admin on the phone the "on the computer" note.
export default function PlayersRoute() {
  return <AdminIndex kind="players" />;
}
