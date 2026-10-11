"use client";

import RatingsScreen from "../ui/RatingsScreen";
import {useParams} from "next/navigation";

// a player's rating: the detail screen on the phone, the list with that player selected on the desktop
export default function PlayerRatingPage() {
  const {playerId} = useParams<{playerId: string}>();
  return <RatingsScreen playerId={Number(playerId)} />;
}
