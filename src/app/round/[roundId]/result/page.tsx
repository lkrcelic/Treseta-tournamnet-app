"use client";

import {getAllMatchesByRoundIdAPI} from "@/app/_fetchers/match/getAllByRoundId";
import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useRoundStore from "@/app/_store/RoundStore";
import {CenteredSpinner, DesktopShell, ErrorNote, PrimaryButton, Screen, ScreenTitle} from "@/app/_ui/sp";
import RoundResultCards from "@/app/ongoing-match/ui/RoundResultCards";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useCallback, useEffect, useState} from "react";

type FinishedMatch = {id?: number; player_pair1_score: number; player_pair2_score: number};

// "Kraj kola": round wins per team and the score of each match
export default function RoundResultPage() {
  const router = useTransitionRouter();
  const {roundId} = useParams<{roundId: string}>();
  const isDesktop = useIsDesktop();
  const setRoundData = useRoundStore((s) => s.setRoundData);
  const sides = useMatchSides();
  const [matches, setMatches] = useState<FinishedMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [round, list] = await Promise.all([getRoundDataAPI(Number(roundId)), getAllMatchesByRoundIdAPI(Number(roundId))]);
      setRoundData(round);
      setMatches(Array.isArray(list) ? (list as FinishedMatch[]) : []);
    } catch {
      setError("Rezultat kola nije moguće učitati.");
    }
  }, [roundId, setRoundData]);

  useEffect(() => {
    load();
  }, [load]);

  const home = (
    <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")} sx={{mt: "auto"}}>
      Početni zaslon
    </PrimaryButton>
  );

  let body: React.ReactNode;
  if (error) body = <ErrorNote onRetry={load}>{error}</ErrorNote>;
  else if (!matches) body = <CenteredSpinner />;
  else
    body = (
      <RoundResultCards
        names={sides.names}
        wins={sides.wins as [number, number]}
        big={isDesktop}
        matches={matches.map((m) => ({
          id: m.id,
          left: sides.left === 1 ? m.player_pair1_score : m.player_pair2_score,
          right: sides.left === 1 ? m.player_pair2_score : m.player_pair1_score,
        }))}
      />
    );

  if (isDesktop) {
    return (
      <DesktopShell active="game" eyebrow="Pobjede u kolu" title="Kraj kola">
        <Box sx={{width: "100%", maxWidth: 720, mx: "auto", display: "flex", flexDirection: "column", gap: "14px", flex: 1}}>
          {body}
          {home}
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen>
      <ScreenTitle eyebrow="Pobjede u kolu" title="Kraj kola" size={40} sx={{pb: "8px"}} />
      {body}
      {home}
    </Screen>
  );
}

