"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useDirectoryFrame} from "@/app/_ui/profiles/PageParts";
import {TeamPageDesktop, TeamPagePhone} from "@/app/_ui/profiles/TeamPage";
import {useParams} from "next/navigation";

// A team's page (handoff §6), for every logged-in user; on the desktop an admin sees it in the Ekipe directory
// (teams/layout.tsx), with the admin controls
export default function TeamRoute() {
  const {teamId} = useParams<{teamId: string}>();
  const isDesktop = useIsDesktop();
  const embedded = useDirectoryFrame() != null;
  return isDesktop ? <TeamPageDesktop teamId={Number(teamId)} embedded={embedded} /> : <TeamPagePhone teamId={Number(teamId)} />;
}
