"use client";

import useAdminPhone from "@/app/_hooks/useAdminPhone";
import {TeamsDirectoryPhone} from "@/app/_ui/admin/DirectoryPhone";
import NewTeamPhone from "@/app/_ui/admin/NewTeamPhone";
import {AdminIndex} from "@/app/_ui/profiles/Directory";
import {NewTeamPage} from "@/app/_ui/profiles/NewTeamPage";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";

// Ekipe (admin, desktop; the nav drawer's "Ekipe"): the directory opens the first team in it. ?new=1 is "Nova ekipa"
// (the directory's button; Upravljanje ligom adds &league=<id> so the team joins that league). Players get Početna; an
// admin on the phone gets the phone's Ekipe and Nova ekipa.
function Teams() {
  const params = useSearchParams();
  const leagueId = Number(params.get("league"));
  const adminPhone = useAdminPhone();
  const league = Number.isInteger(leagueId) && leagueId > 0 ? leagueId : null;
  // the admin's phone: its own Ekipe list and Nova ekipa (DECISIONS #59)
  if (adminPhone) return params.get("new") === "1" ? <NewTeamPhone leagueId={league} /> : <TeamsDirectoryPhone />;
  return (
    <AdminIndex kind="teams">{params.get("new") === "1" ? <NewTeamPage leagueId={Number.isInteger(leagueId) && leagueId > 0 ? leagueId : null} /> : null}</AdminIndex>
  );
}

export default function TeamsRoute() {
  return (
    <Suspense>
      <Teams />
    </Suspense>
  );
}
