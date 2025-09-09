"use client";

import { getLeagueStandingsAPI } from "@/app/_fetchers/league/getStandings";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import StandingsTable, { LeagueStandingsItem } from "@/app/_ui/StandingsTable";
import { Home } from "@mui/icons-material";
import { Box, CircularProgress, Divider, Paper, Typography } from "@mui/material";
import React from "react";
import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/navigation";

export default function PlayersSeating() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const router = useRouter();

  const [leagueStandings, setLeagueStandings] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetchLeagueStandings = async () => {
    try {
      const data = await getLeagueStandingsAPI(1); //TODO remove hardcoded
      setLeagueStandings(data);
    } catch (error) {
      console.error("Error fetching league standings:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLeagueStandings();
  }, []);


  if (loading) {
    return (
      <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh"}}>
        <CircularProgress/>
      </Box>
    );
  }

  if (!leagueStandings) {
    return <p>No data available</p>;
  }

  return (
    <>
      <Box sx={{gridArea: "top", alignSelf: "center"}}>
        <Typography variant="h5" component="h1" sx={{
          fontWeight: 'bold',
          textAlign: 'center',
          color: 'primary.main',
          pb: 1
        }}> Ukupni poredak
        </Typography>
        <Divider/>
      </Box>
      <Box
        sx={{
          gridArea: "body",
          alignSelf: "start",
          justifyContent: {
            xs: "flex-start",
            sm: "center",
          },
          display: "flex",
          overflow: "hidden",
          height: "100%",
          width: "100%",
          fontFamily: "Roboto, sans-serif",
        }}>
        <Paper
          elevation={2}
          sx={{
            borderRadius: 2,
            width: '100% !important',
            m: 0,
            overflowY: 'hidden',
            overflowX: 'auto'
          }}>
          <StandingsTable standings={leagueStandings as LeagueStandingsItem[]}/>
        </Paper>
      </Box>
      <Box sx={{gridArea: "actions"}}>
      <SingleActionButton
          label={"Početni zaslon"}
          icon={<Home />}
          fullWidth={isMobile}
          onClick={() => router.push(`/`)}
        />
      </Box>
    </>
  );
}
