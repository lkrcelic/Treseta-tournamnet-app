import React from "react";
import { Box, CircularProgress } from "@mui/material";
import StandingsTable, { LeagueStandingsItem } from "@/app/_ui/StandingsTable";

type StandingsTabContentProps = {
  loading: boolean;
  leagueStandings: LeagueStandingsItem[] | null;
};

export function StandingsTabContent({ loading, leagueStandings }: StandingsTabContentProps) {
  return (
    <>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flex: 1 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{
          width: "100%",
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden'
        }}>
          <StandingsTable standings={(leagueStandings as LeagueStandingsItem[]) || []} />
        </Box>
      )}
    </>
  );
}
