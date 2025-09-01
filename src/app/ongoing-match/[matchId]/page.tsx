"use client";

import React from 'react';
import {Box, CircularProgress, Divider} from '@mui/material';
import TotalScoreSection from "@/app/ongoing-match/ui/TotalScoreSection";
import ResultsDisplay from "@/app/ongoing-match/ui/ResultsDisplay";
import Action from "@/app/ongoing-match/ui/Action";
import CardDealer from "@/app/ongoing-match/ui/CardDealer";
import {useParams} from "next/navigation";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import useAnnouncementStore from "@/app/_store/bela/announcementStore";
import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";
import useRoundStore from "@/app/_store/RoundStore";
import {getOngoingMatchAPI} from "@/app/_fetchers/ongoingMatch/getOne";

const MobileScoreBoard = () => {
    const {matchId} = useParams();
    const {setOngoingMatch} = useOngoingMatchStore();
    const setRoundData = useRoundStore(state => state.setRoundData)
    const initializePlayerAnnouncements = useAnnouncementStore(state => state.initializePlayersAnnouncements);
    const [loading, setLoading] = React.useState(true);

    const fetchOngoingMatchAndRoundData = async () => {
      try {
        const response = await getOngoingMatchAPI(Number(matchId));
        setOngoingMatch(response);
        initializePlayerAnnouncements(response.playerPair1, response.playerPair2);

        const data = await getRoundDataAPI(Number(response.round_id));
        setRoundData(data);

      } catch (error) {
        console.error('Error fetching ongoing match or round data:', error);
      }

    }

    React.useEffect(() => {
      localStorage.clear();
      fetchOngoingMatchAndRoundData().then(() => setLoading(false));
    }, [matchId]);

    if (loading) {
      return (
        <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh"}}>
          <CircularProgress/>
        </Box>
      );
    }

    return (
      <>
        <Box sx={{gridArea: "top", alignSelf: "end"}}>
          <TotalScoreSection/>
          <CardDealer/>
        </Box>
        <Box sx={{gridArea: "body", overflowY: 'auto',}}>
          <Divider sx={{mb: 2}}/>
          <ResultsDisplay/>
        </Box>
        <Box sx={{gridArea: "actions", alignSelf: "start"}}>
          <Divider sx={{mb: 2}}/>
          <Action/>
        </Box>
      </>
    );
  }
;

export default MobileScoreBoard;
