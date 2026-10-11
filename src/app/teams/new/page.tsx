"use client";

import ManageTeam from "@/app/_ui/teams/ManageTeam";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";

// Manage Teams, opened on a new team. Manage League's "Create team" links here with ?league=<id>, so the team joins
// that league.
function NewTeam() {
  const league = Number(useSearchParams().get("league")) || undefined;
  return <ManageTeam startNew leagueId={league} />;
}

export default function CreateTeam() {
  return (
    <Suspense>
      <NewTeam />
    </Suspense>
  );
}
