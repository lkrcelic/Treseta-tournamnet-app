"use client";

import {AdminIndex} from "@/app/_ui/profiles/Directory";
import {NewTeamPage} from "@/app/_ui/profiles/NewTeamPage";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";

// Ekipe (admin, desktop; the nav drawer's "Ekipe"): the directory opens the first team in it. ?new=1 is "Nova ekipa"
// (the directory's button; Upravljanje ligom adds &league=<id> so the team joins that league). Players get Početna,
// an admin on the phone the "on the computer" note.
function Teams() {
  const params = useSearchParams();
  const leagueId = Number(params.get("league"));
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
