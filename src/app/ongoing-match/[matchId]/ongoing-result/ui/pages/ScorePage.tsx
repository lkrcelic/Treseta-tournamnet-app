"use client";

import React, {useState} from "react";
import {Box} from "@mui/material";
import DigitGrid from "@/app/ongoing-match/[matchId]/ongoing-result/ui/DigitGrid";
import useResultStore from "@/app/_store/bela/resultStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import useAnnouncementStore from "@/app/_store/bela/announcementStore";
import {useParams, useRouter} from "next/navigation";
import DoubleActionButton from "@/app/_ui/DoubleActionButton";
import {updateOngoingBelaResultAPI} from "@/app/_fetchers/ongoingBelaResult/updateOne";
import {createOngoingBelaResultAPI} from "@/app/_fetchers/ongoingBelaResult/create";
import {ActionProps} from "@/app/ongoing-match/[matchId]/ongoing-result/ui/pages/TrumpCallerPage";

export default function ScorePage({actionType}: ActionProps) {
  return (
    <>

      <Box sx={{gridArea: "body", alignSelf: "end"}}>
        <DigitGrid/>
      </Box>
      <Box sx={{gridArea: "actions", alignSelf: "start"}}>
        <ActionButtons actionType={actionType}/>
      </Box>
    </>
  );
}

function ActionButtons({actionType}: ActionProps) {
  const {
    resultData,
    resetResult,
    setTotalPoints,
    setCardShufflerIdAndTrumpCallerPosition,
  } = useResultStore();
  const {
    ongoingMatch: {
      playerPair1,
      playerPair2,
      seating_order,
      current_shuffler_index,
    },
  } = useOngoingMatchStore();
  const {resetAnnouncements} = useAnnouncementStore();
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const params = useParams();

  const handleSave = async () => {
    if (isLoading) return; // Prevent double execution
    
    try {
      setIsLoading(true);
      
      setTotalPoints(playerPair1, playerPair2);
      setCardShufflerIdAndTrumpCallerPosition(seating_order!, current_shuffler_index!);
      const updatedResultData = useResultStore.getState?.().resultData;

      if (actionType === "CREATE") {
        await createOngoingBelaResultAPI({result: updatedResultData})
      }
      if (actionType === "UPDATE") {
        await updateOngoingBelaResultAPI({resultId: params.resultId, result: updatedResultData})
      }
      
      resetResult();
      resetAnnouncements();

      router.push(`/ongoing-match/${params.matchId}`);
    } catch (error) {
      console.error("Error saving result:", error);
      setIsLoading(false); // Reset loading state on error
    }
  };

  return <DoubleActionButton
    secondButtonLabel={isLoading ? "Spremanje..." : "Spremi"}
    secondButtonOnClick={handleSave}
    secondButtonDisabled={isLoading || (resultData.player_pair1_game_points === 0 && resultData.player_pair2_game_points === 0)}
  />

}
