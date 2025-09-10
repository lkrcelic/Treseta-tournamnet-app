"use client";

import {Box, Stack, TextField, Typography, Button, Collapse} from "@mui/material";
import Dropdown, {DropdownOption} from "@/app/createRound/ui/Dropdown";
import {useState} from "react";
import SelectTable, {TableEntry} from "@/app/createRound/ui/SelectTable";
import {Team} from "@prisma/client";
import {useRouter} from "next/navigation";
import {createMultipleRoundsAPI} from "@/app/_fetchers/round/createMultipleRounds";

interface LeagueTeam {
  league_id: number;
  team: Team;
}

interface League {
  league_id: number;
  league_name: string;
}

export default function CreateRound() {
  const router = useRouter();
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [numberOfRounds, setNumberOfRounds] = useState<number>(4);
  const [windowSize, setWindowSize] = useState<number>(8);
  const [showOptions, setShowOptions] = useState<boolean>(false);

  const handleSelect = (leagueId: number) => {
    setSelectedLeagueId(leagueId);
  };

  const fetchLeagues = async () => {
    try {
      const response = await fetch("/api/leagues");
      const data = await response.json();
      return data.map((league: League) => ({id: league.league_id, name: league.league_name})) as DropdownOption[];
    } catch (error) {
      console.error("Error fetching leagues:", error);
      return [] as DropdownOption[];
    }
  };

  const fetchTeams = async () => {
    if (selectedLeagueId === null) return [] as TableEntry[];

    try {
      const response = await fetch("/api/leagueTeams/" + selectedLeagueId.toString());
      const data = await response.json();
      return data.map(
        (leagueTeam: LeagueTeam) => ({id: leagueTeam.team.team_id, name: leagueTeam.team.team_name} as TableEntry)
      );
    } catch (error) {
      console.error("Error fetching teams: ", error);
      return [] as TableEntry[];
    }
  };

  const createRound = async (teamIds: number[]) => {
    if (selectedLeagueId === null) {
      return;
    }

    const createdRoundNumber = await createMultipleRoundsAPI(selectedLeagueId, teamIds, numberOfRounds, windowSize);
    router.push(`/round/pairings/${createdRoundNumber}`);
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          padding: 2,
          boxSizing: "border-box",
          textAlign: "center",
          overflowY: 'auto'
        }}
      >
        {selectedLeagueId === null ? (
          <Dropdown onSelect={handleSelect} getOptions={fetchLeagues} />
        ) : (
          <>
            <Stack direction="row" spacing={1} sx={{justifyContent: "center", alignItems: "center", mb: 1}}>
              <Button variant="text" size="small" onClick={() => setShowOptions((s) => !s)}>
                Options
              </Button>
              <Typography variant="caption" color="text.secondary">
                Rounds: {numberOfRounds}, Window: {windowSize}
              </Typography>
            </Stack>
            <Collapse in={showOptions} timeout="auto" unmountOnExit>
              <Stack direction="row" spacing={2} sx={{justifyContent: "center", alignItems: "center", mb: 1}}>
                <TextField
                  label="Number of rounds"
                  type="number"
                  inputProps={{min: 1, max: 5}}
                  value={numberOfRounds}
                  onChange={(e) => setNumberOfRounds(Math.max(1, Math.min(5, Number(e.target.value))))}
                  size="small"
                />
                <TextField
                  label="Window size"
                  type="number"
                  inputProps={{min: 2, max: 200}}
                  value={windowSize}
                  onChange={(e) => setWindowSize(Math.max(2, Math.min(200, Number(e.target.value))))}
                  size="small"
                />
              </Stack>
            </Collapse>
            <SelectTable onLoad={fetchTeams} onCreate={createRound} />
          </>
        )}
      </Box>
    </>
  );
}