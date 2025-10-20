import React from "react";
import {Box, Chip, Divider, Paper, Typography} from "@mui/material";
import {RoundResultCard} from "./RoundResultCard";
import Circle from '@mui/icons-material/Circle';
import {Grid} from '@mui/system'
import { MatchResponse } from "@/app/_interfaces/match";

type RoundResult = {
  team1Name: string;
  team2Name: string;
  team1Wins: number;
  team2Wins: number;
  active: boolean;
  tableNumber: number;
  matches: MatchResponse[];
};

type RoundResultsPanelProps = {
  roundNumber: number;
  rounds: RoundResult[];
  activeRounds?: number;
};

export function RoundResultsPanel({roundNumber, rounds, activeRounds = 0}: RoundResultsPanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        py: 0,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Box sx={{position: 'sticky', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Typography variant="h6" sx={{mb: 1, fontWeight: 'medium'}}>Round {roundNumber}</Typography>
        {activeRounds > 0 && (
          <Box
            sx={{
              position: 'relative',
              mb: 1,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '16px',
                animation: 'pulseShadow 1.5s infinite',
                zIndex: 0
              },
              '@keyframes pulseShadow': {
                '0%': {
                  boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.4)'
                },
                '70%': {
                  boxShadow: '0 0 0 6px rgba(211, 47, 47, 0)'
                },
                '100%': {
                  boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)'
                }
              }
            }}
          >
            <Chip
              icon={<Circle sx={{fontSize: 11}}/>}
              label={`LIVE: ${activeRounds}`}
              color="error"
              sx={{
                px: 1,
                fontSize: 13,
                alignItems: 'center',
                fontWeight: 'bold',
                position: 'relative',
                zIndex: 1
              }}
            />
          </Box>
        )}
      </Box>
      <Divider sx={{mb: 2}}/>
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        height: '100%',
        minHeight: 0,
        pr: 1.5
      }}>
        <Grid container spacing={2} sx={{pb:1}}>
          {rounds.map((round, index) => (
            <Grid item key={index} size={{xs: 12, md: 4, lg: 2}}>
              <RoundResultCard
                team1Name={round.team1Name}
                team2Name={round.team2Name}
                team1Wins={round.team1Wins}
                team2Wins={round.team2Wins}
                active={round.active}
                tableNumber={round.tableNumber}
                matches={round.matches}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
}
