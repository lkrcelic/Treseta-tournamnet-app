"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {PlayerPageDesktop, PlayerPagePhone} from "@/app/_ui/profiles/PlayerPage";
import {useParams} from "next/navigation";

// A player's page (handoff §6), for every logged-in user; the server leaves out other players' personal data
export default function PlayerRoute() {
  const {playerId} = useParams<{playerId: string}>();
  const isDesktop = useIsDesktop();
  return isDesktop ? <PlayerPageDesktop playerId={Number(playerId)} /> : <PlayerPagePhone playerId={Number(playerId)} />;
}
