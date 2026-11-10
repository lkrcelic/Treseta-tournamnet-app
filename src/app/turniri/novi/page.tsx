"use client";

import useManagePhone from "@/app/_hooks/useManagePhone";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {DesktopOnlyNote} from "@/app/_ui/sp";
import NewTournamentDesktop from "@/app/_ui/tournaments/admin/NewTournamentDesktop";
import NewTournamentPhone from "@/app/_ui/tournaments/admin/NewTournamentPhone";

// Novi turnir (Claude Design "Turniri admin" A2, M10); ?kopiraj=<id> fills it in from that tournament
export default function NewTournamentPage() {
  const isDesktop = useIsDesktop();
  const adminPhone = useManagePhone("tournament.create");
  if (isDesktop) return <NewTournamentDesktop />;
  return adminPhone ? <NewTournamentPhone /> : <DesktopOnlyNote />;
}
