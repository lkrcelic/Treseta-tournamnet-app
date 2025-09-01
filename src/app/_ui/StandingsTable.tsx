import React from "react";
import {Grid, keyframes} from "@mui/system";
import {Box} from "@mui/material";

export type LeagueStandingsItem = {
  id: string | number;
  team: {
    team_name: string;
  };
  rounds_played: number;
  wins: number;
  draws: number;
  losses: number;
  point_difference: number;
  score: number;
  active_round_count: number;
}

export interface LeagueStandingsProps {
  standings: LeagueStandingsItem[];
}

const pulse = keyframes`
    0% {
        filter: drop-shadow(0 0 1px rgba(211, 47, 47, 0.7));
    }
    25% {
        filter: drop-shadow(0 0 2px rgba(211, 47, 47, 0.7));
    }
    50% {
        filter: drop-shadow(0 0 3px rgba(211, 47, 47, 0.5));
    }
    100% {
        filter: drop-shadow(0 0 0px rgba(211, 47, 47, 0));
    }
`;

export default function StandingsTable({standings}: LeagueStandingsProps) {
  return (
    <Box
      sx={{display: "inline-block", height: '100%', width: "100%", minWidth: "550px", overflow: "auto"}}
    >
      <Grid
        container
        spacing={2}
        paddingY={1}
        paddingLeft={1}
        sx={{
          textAlign: "center",
          fontWeight: "bold",
          position: "sticky",
          top: 0,
          backgroundColor: "secondary.main",
        }}
      >
        <Grid item size={{xs: 0.5}}>-</Grid>
        <Grid item textAlign={"left"} size={{xs: 3.4}}>Ime ekipe</Grid>
        <Grid item size={{xs: 1.35}}>OK</Grid>
        <Grid item size={{xs: 1.35}}>POB</Grid>
        <Grid item size={{xs: 1.35}}>NER</Grid>
        <Grid item size={{xs: 1.35}}>IZG</Grid>
        <Grid item size={{xs: 1.45}}>RAZ</Grid>
        <Grid item size={{xs: 1.25}}>BOD</Grid>
      </Grid>

      {standings.map((row, index) => (
        <Grid
          container
          spacing={2}
          key={row.id}
          paddingY={1}
          paddingLeft={1}
          sx={{
            textAlign: "center",
            borderBottom: "1px solid #eee",
            backgroundColor: index % 2 ? "background.default" : "",

          }}
        >
          <Grid
            item
            size={{xs: 0.5}}
            sx={{
              color: row.active_round_count > 0 ? 'error.main' : 'inherit',
              fontWeight: row.active_round_count > 0 ? 'bold' : 'inherit',
              // Conditionally add the animation and circle effect
              ...(row.active_round_count > 0 && {
                borderRadius: '50%',
                animation: `${pulse} 1.5s infinite`,
              }),
            }}
          >
            {index + 1}
          </Grid>
          <Grid item textAlign={"left"} size={{xs: 3.4}}>{row.team.team_name}</Grid>
          <Grid item size={{xs: 1.35}}>{row.rounds_played}</Grid>
          <Grid item size={{xs: 1.35}}>{row.wins}</Grid>
          <Grid item size={{xs: 1.35}}>{row.draws}</Grid>
          <Grid item size={{xs: 1.35}}>{row.losses}</Grid>
          <Grid item size={{xs: 1.45}}>{row.point_difference}</Grid>
          <Grid item size={{xs: 1.25}} style={{
            color: row.active_round_count > 0 ? '#d32f2f' : 'inherit',
            fontWeight: row.active_round_count > 0 ? 'bold' : 'inherit'
          }}
          >{row.score}
          </Grid>
        </Grid>
      ))}
    </Box>
  );
}
