"use client";

import {TeamSide} from "@/app/_interfaces/side";
import {myTeamIsTeam1} from "@/app/_hooks/useOpenTable";
import useAuthStore from "@/app/_store/authStore";
import useRoundStore from "@/app/_store/RoundStore";

// Left/right orientation of the two teams: the viewer's team on the left (green), the opponent on the right (red).
// Scores and announcements are stored by absolute side (1 = round.team1, 2 = round.team2).
export default function useMatchSides() {
  const round = useRoundStore((s) => s.roundData);
  const userId = useAuthStore((s) => s.user?.id);
  const team1Left = myTeamIsTeam1(round, userId);
  const left: TeamSide = team1Left ? 1 : 2;
  const right: TeamSide = team1Left ? 2 : 1;
  const name = (side: TeamSide) => (side === 1 ? round.team1?.team_name : round.team2?.team_name) ?? (side === left ? "MI" : "VI");
  const wins = (side: TeamSide) => (side === 1 ? round.team1_wins : round.team2_wins) ?? 0;
  return {
    left,
    right,
    sides: [left, right] as [TeamSide, TeamSide],
    names: [name(left), name(right)] as [string, string],
    wins: [wins(left), wins(right)] as [number, number],
    // team1/team2 key used by the result store's activeTeam
    key: (side: TeamSide) => (side === 1 ? "team1" : "team2") as "team1" | "team2",
    tableNumber: round.table_number ?? null,
    roundNumber: round.round_number ?? null,
    matchNumber: ((round.team1_wins ?? 0) + (round.team2_wins ?? 0)) + 1,
  };
}
