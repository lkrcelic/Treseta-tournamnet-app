"use client";

import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";
import {getOpenRoundByPlayerIdAPI} from "@/app/_fetchers/round/getOpenByPlayerId";
import {RoundExtendedResponse} from "@/app/_interfaces/round";
import useAuthStore from "@/app/_store/authStore";
import {useEffect, useState} from "react";

export type OpenTable = {
  roundId: number;
  table: number | null;
  roundNumber: number | null;
  // the player's own team first
  myTeam: string;
  opponent: string;
  // the running match's points, the player's own team first; null before a match is started
  score: [number, number] | null;
};

// orientation used everywhere: the viewer's team on the left; if they play in neither, team1 stays left
export function myTeamIsTeam1(round: Pick<RoundExtendedResponse, "team1" | "team2">, userId: number | null | undefined): boolean {
  const inTeam2 = userId != null && (round.team2?.teamPlayers ?? []).some((tp) => tp.player?.id === userId);
  const inTeam1 = userId != null && (round.team1?.teamPlayers ?? []).some((tp) => tp.player?.id === userId);
  return inTeam1 || !inTeam2;
}

// The next table the logged-in player sits at, if they have an open round
export default function useOpenTable(): {table: OpenTable | null; loading: boolean} {
  const userId = useAuthStore((s) => s.user?.id);
  const [table, setTable] = useState<OpenTable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {roundId, ongoingScore} = await getOpenRoundByPlayerIdAPI();
        const round = await getRoundDataAPI(roundId);
        if (cancelled) return;
        const left = myTeamIsTeam1(round, userId);
        const t1 = round.team1?.team_name ?? "";
        const t2 = round.team2?.team_name ?? "";
        setTable({
          roundId,
          table: round.table_number ?? null,
          roundNumber: round.round_number ?? null,
          myTeam: left ? t1 : t2,
          opponent: left ? t2 : t1,
          score: ongoingScore ? (left ? ongoingScore : [ongoingScore[1], ongoingScore[0]]) : null,
        });
      } catch {
        // no open round (404) or offline: no card
        if (!cancelled) setTable(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {table, loading};
}
