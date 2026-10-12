"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import {DesktopOnlyNote} from "@/app/_ui/sp";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect} from "react";

// Novo kolo is the first view of Upravljanje ligom on the desktop, so this address sends the admin there. Rounds are
// created only on the desktop; the phone says so.
export default function CreateRound() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const selectedLeague = useSelectedLeagueId();

  useEffect(() => {
    if (isDesktop && selectedLeague != null) router.router.replace(`/league/${selectedLeague}/manage?view=create`);
  }, [isDesktop, selectedLeague, router]);

  if (isDesktop) return null;
  return <DesktopOnlyNote />;
}
