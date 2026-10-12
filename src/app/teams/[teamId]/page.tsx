"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {TeamPageDesktop, TeamPagePhone} from "@/app/_ui/profiles/TeamPage";
import {useParams} from "next/navigation";

// A team's page (handoff §6), for every logged-in user
export default function TeamRoute() {
  const {teamId} = useParams<{teamId: string}>();
  const isDesktop = useIsDesktop();
  return isDesktop ? <TeamPageDesktop teamId={Number(teamId)} /> : <TeamPagePhone teamId={Number(teamId)} />;
}
