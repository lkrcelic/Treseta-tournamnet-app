"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import AdminTonight from "@/app/_ui/admin/AdminTonight";
import DesktopHome from "@/app/_ui/home/DesktopHome";
import PhoneHome from "@/app/_ui/home/PhoneHome";
import useManagePhone from "@/app/_hooks/useManagePhone";
import TournamentsPhone from "@/app/_ui/tournaments/admin/TournamentsPhone";

// Početna; an admin's phone opens on Večer lige instead (admin-mobile 01), unless they switched to "Prikaz igrača".
// Someone who runs tournaments but not the league (an organizer, DECISIONS #86) has no Večer lige, so their phone
// opens on their Turniri — the screen their bottom bar starts from.
export default function Home() {
  const isDesktop = useIsDesktop();
  const leaguePhone = useManagePhone("league.manage");
  const tournamentPhone = useManagePhone("tournament.manage.own");
  if (isDesktop) return <DesktopHome />;
  if (leaguePhone) return <AdminTonight />;
  return tournamentPhone ? <TournamentsPhone /> : <PhoneHome />;
}
