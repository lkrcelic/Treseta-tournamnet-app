"use client";

import useAdminPhone from "@/app/_hooks/useAdminPhone";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import {DesktopOnlyNote} from "@/app/_ui/sp";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect} from "react";

// Novo kolo is a view of Upravljanje ligom (the first on the desktop, the admin's Novo kolo on the phone), so this
// address sends the admin there. Anyone else on the phone is told it is edited on the computer.
export default function CreateRound() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const adminPhone = useAdminPhone();
  const selectedLeague = useSelectedLeagueId();
  const goes = isDesktop || adminPhone;

  useEffect(() => {
    if (goes && selectedLeague != null) router.router.replace(`/league/${selectedLeague}/manage?view=create`);
  }, [goes, selectedLeague, router]);

  if (goes) return null;
  return <DesktopOnlyNote />;
}
