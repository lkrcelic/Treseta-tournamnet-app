"use client";

import React, {useEffect, useState} from "react";
import {Box, Card, CardContent, Divider, Typography} from "@mui/material";
import {getRoundsByRoundNumber} from "@/app/_fetchers/round/getRoundsByRoundNumber";
import {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";
import {Grid} from "@mui/system";
import {useParams} from "next/navigation";

export interface MatchupTableEntry {
  id: number;
  team1Name: string;
  team2Name: string;
  tableNumber: number;
}

export default function RoundPairings() {
  const {roundNumber} = useParams();
  const [entries, setEntries] = useState<MatchupTableEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getRoundsByRoundNumber(Number(roundNumber));
      setEntries(
        data.map((round: RoundMatchup) => ({
          id: round.id,
          team1Name: round.team1?.team_name ?? "",
          team2Name: round.team2?.team_name ?? "",
          tableNumber: round.table_number || 0,
        }))
      );
    };

    fetchData();
  }, [roundNumber]);

  return (
    <>
      <Box sx={{width: '100%', height: '100%', gridArea: 'top'}}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            mb: 2,
            fontWeight: 'medium',
            textAlign: 'center'
          }}
        >
          Round {roundNumber}
        </Typography>

        <Divider/>
      </Box>
      <Box sx={{width: '100%', overflowY: 'auto'}}>
        <Grid container spacing={2}>
          {entries.map((entry) => (
            <Grid item size={{xs: 12, sm: 6, md: 4}} key={entry.id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  height: '100%',
                  p: 0
                }}
              >
                <CardContent sx={{p: 2, '&:last-child': {pb: 2}}}>
                  <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1}}>
                    <Typography variant="body1"
                                sx={{fontWeight: 'small', color: 'gray'}}> Table {entry.tableNumber}
                    </Typography>
                  </Box>
                  <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                    <Typography variant="body1" sx={{fontWeight: 'medium', flex: 1}}>{entry.team1Name}</Typography>
                  </Box>
                  <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Typography variant="body1" sx={{fontWeight: 'medium', flex: 1}}>{entry.team2Name}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </>
  );
}
