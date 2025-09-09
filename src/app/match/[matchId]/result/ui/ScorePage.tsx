"use client";

import {createResultAPI} from "@/app/_fetchers/result/create";
import {updateResultByIdAPI} from "@/app/_fetchers/result/updateById";
import useResultStore from "@/app/_store/resultStore";
import DoubleActionButton from "@/app/_ui/DoubleActionButton";
import DigitGrid from "@/app/match/[matchId]/result/ui/DigitGrid";
import {Box} from "@mui/material";
import {useParams, useRouter} from "next/navigation";
import {useState} from "react";
import TeamsScoreSection from "./TeamsScoreSection";

type ActionProps = {
  actionType: "CREATE" | "UPDATE";
};

export default function ScorePage({actionType}: ActionProps) {
  return (
    <>
      <Box sx={{gridArea: "top", alignSelf: "end"}}>
        <TeamsScoreSection />
      </Box>
      <Box sx={{gridArea: "body", alignSelf: "end"}}>
        <DigitGrid />
      </Box>
      <Box sx={{gridArea: "actions", alignSelf: "start"}}>
        <ActionButtons actionType={actionType} />
      </Box>
    </>
  );
}

function ActionButtons({actionType}: ActionProps) {
  const {resultData, resetResult} = useResultStore();
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const params = useParams();

  const handleSave = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      const updatedResultData = useResultStore.getState?.().resultData;
      updatedResultData.match_id = Number(params.matchId);

      if (actionType === "CREATE") {
        await createResultAPI(updatedResultData);
      }
      if (actionType === "UPDATE") {
        await updateResultByIdAPI({resultId: params.resultId, result: updatedResultData});
      }

      resetResult();

      router.push(`/match/${params.matchId}`);
    } catch (error) {
      console.error("Error saving result:", error);
      setIsLoading(false); // Reset loading state on error
    }
  };

  return (
    <DoubleActionButton
      secondButtonLabel={isLoading ? "Spremanje..." : "Spremi"}
      secondButtonOnClick={handleSave}
      secondButtonDisabled={isLoading || (resultData.team1_game_points === 0 && resultData.team2_game_points === 0)}
    />
  );
}
