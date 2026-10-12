"use client";

import {getPlayerOverviewAPI} from "@/app/_fetchers/player/overview";
import {Overview, OverviewCache, useOverview} from "@/app/_hooks/useOverview";
import {PlayerOverview} from "@/app/_interfaces/profiles";

const cache: OverviewCache<PlayerOverview> = new Map();

// The Player page (/players/[playerId]): {data, setData, error, missing, loading, reload}
export default function usePlayerOverview(playerId: number): Overview<PlayerOverview> {
  return useOverview(playerId, getPlayerOverviewAPI, cache, "Igrač se nije učitao.");
}
