"use client";

import UserBootstrapper from "@/app/_bootstrap/UserBootstrapper";
import { getAllMatchesByQueryAPI } from "@/app/_fetchers/match/getAllByQuery";
import { getRoundByIdAPI } from "@/app/_fetchers/round/getByIdAPI";
import { MatchResponse } from "@/app/_interfaces/match";
import useRoundStore from "@/app/_store/roundStore";
import theme from "@/app/_styles/theme";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import Home from "@mui/icons-material/Home";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { Grid } from "@mui/system";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import LoadingScoreBoard from "./LoadingScoreBoard";

const MobileScoreBoard = () => {
  const router = useRouter();
  const {roundId} = useParams();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const {
    roundData: {team1_wins, team2_wins, team1, team2},
    setRoundData,
  } = useRoundStore();
  const [matches, setMatches] = useState<MatchResponse[]>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoundData = async () => {
    try {
      const data = await getRoundByIdAPI(Number(roundId));
      setRoundData(data);
      return true;
    } catch (error) {
      console.error("Error fetching round data:", error);
      return false;
    }
  };

  const fetchRoundMatches = async () => {
    try {
      const data = await getAllMatchesByQueryAPI({round_id: Number(roundId)});
      setMatches(data);
      return true;
    } catch (error) {
      console.error("Error fetching round matches:", error);
      return false;
    }
  };

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchRoundData(), fetchRoundMatches()]);
      setIsLoading(false);
    };

    loadData();
  }, [roundId]);

  if (isLoading) {
    return <LoadingScoreBoard isMobile={isMobile} />;
  }

  return (
    <>
      <UserBootstrapper />
      <Box sx={{gridArea: "top", alignSelf: "end"}}>
        <Grid container justifyContent="space-between" alignItems="top" spacing={6}>
          <Grid item size={{xs: 6}}>
            <Grid container direction="column" alignItems="center" spacing={2} paddingTop={1}>
              <Box
                sx={{
                  backgroundColor: "team1.main",
                  color: "team1.contrastText",
                  width: 55,
                  height: 55,
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="h4" color="#fff">
                  {team1_wins}
                </Typography>
              </Box>
              <Typography variant="h7">{team1?.team_name}</Typography>
            </Grid>
          </Grid>
          <Grid item size={{xs: 6}}>
            <Grid container direction="column" alignItems="center" spacing={2} paddingTop={1}>
              <Box
                sx={{
                  backgroundColor: "team2.main",
                  color: "team2.contrastText",
                  width: 55,
                  height: 55,
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="h4" color="#fff">
                  {team2_wins}
                </Typography>
              </Box>
              <Typography variant="h7" align="center">
                {team2?.team_name}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
      </Box>
      <Box sx={{gridArea: "body", overflowY: "auto", paddingTop: 4}}>
        <Grid container spacing={5} justifyContent="center" alignItems="bottom">
          {matches?.map((match, index) => (
            <Box key={index} sx={{width: "88%", borderRadius: "20px"}}>
              <Grid
                container
                item
                size={{xs: 12}}
                justifyContent="space-evenly"
                alignItems="center"
                sx={{backgroundColor: "secondary.main", borderRadius: "20px", paddingY: 0.5}}
              >
                <Grid item size={{xs: 4}}>
                  <Typography variant="h4" textAlign="center" color={"default"} paddingRight={1}>
                    {match.team1_score}
                  </Typography>
                </Grid>

                <Grid item size={{xs: 2}}>
                  <Typography variant="h4" textAlign="center">
                    •
                  </Typography>
                </Grid>

                <Grid item size={{xs: 4}}>
                  <Typography variant="h4" textAlign="center" color={"default"} paddingLeft={1}>
                    {match.team2_score}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          ))}
        </Grid>
      </Box>
      <Box sx={{gridArea: "actions", alignSelf: "start"}}>
        <SingleActionButton
          label={"Početni zaslon"}
          icon={<Home />}
          fullWidth={isMobile}
          onClick={() => router.push(`/`)}
        />
      </Box>
    </>
  );
};

export default MobileScoreBoard;
