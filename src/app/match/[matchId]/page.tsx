"use client";

import {getMatchByIdWithResultsAPI} from "@/app/_fetchers/match/getByIdWithResults";
import {getRoundByIdAPI} from "@/app/_fetchers/round/getByIdAPI";
import useMatchStore from "@/app/_store/matchStore";
import useRoundStore from "@/app/_store/roundStore";
import {Box, CircularProgress, Divider} from "@mui/material";
import {useParams} from "next/navigation";
import React from "react";
import Action from "../ui/Action";
import ResultsDisplay from "../ui/ResultsDisplay";
import TotalScoreSection from "../ui/TotalScoreSection";
import UserBootstrapper from "@/app/_bootstrap/UserBootstrapper";

const MobileScoreBoard = () => {
  const {matchId} = useParams();
  const {setMatch} = useMatchStore();
  const setRoundData = useRoundStore((state) => state.setRoundData);
  const [loading, setLoading] = React.useState(true);

  const fetchMatchAndRoundData = async () => {
    try {
      const response = await getMatchByIdWithResultsAPI(Number(matchId));
      setMatch(response);

      const data = await getRoundByIdAPI(Number(response.round_id));
      setRoundData(data);
    } catch (error) {
      console.error("Error fetching match or round data:", error);
    }
  };

  React.useEffect(() => {
    localStorage.clear();
    fetchMatchAndRoundData().then(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh"}}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <UserBootstrapper />
      <Box sx={{gridArea: "top", alignSelf: "end"}}>
        <TotalScoreSection />
      </Box>
      <Box sx={{gridArea: "body", overflowY: "auto"}}>
        <Divider sx={{mb: 2}} />
        <ResultsDisplay />
      </Box>
      <Box sx={{gridArea: "actions", alignSelf: "start"}}>
        <Divider sx={{mb: 2}} />
        <Action />
      </Box>
    </>
  );
};
export default MobileScoreBoard;
