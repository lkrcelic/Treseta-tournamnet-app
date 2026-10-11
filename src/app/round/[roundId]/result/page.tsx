"use client";

import {getAllMatchesByRoundIdAPI} from "@/app/_fetchers/match/getAllByRoundId";
import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useRoundStore from "@/app/_store/RoundStore";
import {color, font, teamColor, teamTint} from "@/app/_styles/tokens";
import {Card, CenteredSpinner, DesktopShell, ErrorNote, PrimaryButton, Screen, ScreenTitle, tabular, VisuallyHidden} from "@/app/_ui/sp";
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

  const [w0, w1] = sides.wins;
  const winner = matches && (w0 !== w1) ? (w0 > w1 ? 0 : 1) : null;
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
      <>
        <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
          {([0, 1] as const).map((i) => (
            <Card
              key={i}
              sx={{position: "relative", overflow: "hidden", height: isDesktop ? 260 : 220, borderRadius: "24px", p: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between"}}
            >
              <Box aria-hidden sx={{position: "absolute", inset: 0, background: teamTint[i], opacity: winner === i ? 1 : 0, transition: "opacity 500ms ease"}} />
              <Box component="h2" sx={{position: "relative", m: 0, fontSize: 16, fontWeight: 600, overflowWrap: "anywhere"}}>
                {sides.names[i]}
              </Box>
              <Box
                sx={{
                  position: "relative",
                  fontFamily: font.display,
                  fontSize: isDesktop ? 144 : 120,
                  fontWeight: 800,
                  lineHeight: 0.8,
                  color: teamColor[i],
                  transformOrigin: "left bottom",
                  animation: winner === i ? "spPulse 760ms ease-in-out 2" : "none",
                }}
              >
                {sides.wins[i]}
                <VisuallyHidden> {sides.wins[i] === 1 ? "pobjeda" : "pobjede"}</VisuallyHidden>
              </Box>
            </Card>
          ))}
        </Box>
        <Card component="ol" aria-label="Mečevi" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden"}}>
          {matches.map((m, i) => (
            <Box
              component="li"
              key={m.id ?? i}
              sx={{height: 56, display: "grid", gridTemplateColumns: "90px 1fr 1fr", alignItems: "center", px: "16px", borderBottom: `1px solid ${color.line}`}}
            >
              <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: color.muted}}>
                Meč {i + 1}
              </Box>
              {[sides.left === 1 ? m.player_pair1_score : m.player_pair2_score, sides.left === 1 ? m.player_pair2_score : m.player_pair1_score].map((v, k) => (
                <Box key={k} component="span" sx={{textAlign: "center", fontFamily: font.display, fontSize: 24, fontWeight: 700, ...tabular}}>
                  {v}
                </Box>
              ))}
            </Box>
          ))}
          {matches.length === 0 && (
            <Box component="li" sx={{p: "18px 16px", color: color.muted, fontSize: 15}}>
              Nema odigranih mečeva.
            </Box>
          )}
        </Card>
      </>
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

