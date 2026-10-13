"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useDirectoryFrame} from "@/app/_ui/profiles/PageParts";
import {PlayerPageDesktop, PlayerPagePhone} from "@/app/_ui/profiles/PlayerPage";
import {useParams} from "next/navigation";

// A player's page (handoff §6), for every logged-in user; the server leaves out other players' personal data. On the
// desktop an admin sees it in the Igrači directory (players/layout.tsx).
export default function PlayerRoute() {
  const {playerId} = useParams<{playerId: string}>();
  const isDesktop = useIsDesktop();
  const embedded = useDirectoryFrame() != null;
  return isDesktop ? <PlayerPageDesktop playerId={Number(playerId)} embedded={embedded} /> : <PlayerPagePhone playerId={Number(playerId)} />;
}
