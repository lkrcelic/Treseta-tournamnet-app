"use client";

import TableScorepad from "@/app/league/[leagueId]/daily-standings/table/[roundId]/page";

// A tournament's table: the same page as a league night's (the admin's scorepad, Pregled stola, or the player's game);
// its links lead back to the tournament's Kolo (_lib/ui/tableScope.ts)
export default function TournamentTable() {
  return <TableScorepad />;
}
