"use client";

import {getTeamOverviewAPI} from "@/app/_fetchers/team/overview";
import {Overview, OverviewCache, useOverview} from "@/app/_hooks/useOverview";
import {TeamOverview} from "@/app/_interfaces/profiles";

const cache: OverviewCache<TeamOverview> = new Map();

// The Team page (/teams/[teamId]): {data, setData, error, missing, loading, reload}
export default function useTeamOverview(teamId: number): Overview<TeamOverview> {
  return useOverview(teamId, getTeamOverviewAPI, cache, "Ekipa se nije učitala.");
}
