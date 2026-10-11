"use client";

import {getRoundsByRoundNumber} from "@/app/_fetchers/round/getRoundsByRoundNumber";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import type {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";
import {plural} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {Card, DesktopShell, ellipsis, EmptyState, ErrorNote, LoadingRows, PrimaryButton, Screen, ScreenTitle, ScrollArea} from "@/app/_ui/sp";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import {useActiveLeagueId} from "@/app/_hooks/useLeagues";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useEffect, useState} from "react";

type Pairing = {id: number; table: number; a: string; b: string};

// Who sits where in a new round, shown right after the admin creates it
export default function RoundPairings() {
  const {roundNumber} = useParams<{roundNumber: string}>();
  const fromUrl = Number(useSearchParams().get("league")) || null;
  const activeId = useActiveLeagueId();
  const leagueId = fromUrl ?? activeId;
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const [pairs, setPairs] = useState<Pairing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (leagueId === undefined) return; // still finding the league being played now
    setError(null);
    try {
      const data = leagueId == null ? [] : await getRoundsByRoundNumber(Number(roundNumber), leagueId);
      setPairs(
        (data ?? [])
          .map((r: RoundMatchup, i: number) => ({id: r.id, table: r.table_number || i + 1, a: r.team1?.team_name ?? "", b: r.team2?.team_name ?? ""}))
          .sort((x, y) => x.table - y.table)
      );
    } catch {
      setError("Parove nije moguće učitati.");
    }
  }, [roundNumber, leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = pairs ? `${pairs.length} ${plural(pairs.length, "stol", "stola", "stolova")}` : "";

  const list = error ? (
    <ErrorNote onRetry={load}>{error}</ErrorNote>
  ) : !pairs ? (
    <Card>
      <LoadingRows rows={6} height={56} />
    </Card>
  ) : pairs.length === 0 ? (
    <Card>
      <EmptyState>Za ovo kolo nema parova.</EmptyState>
    </Card>
  ) : (
    <Box
      component="ol"
      aria-label={`Parovi, Round ${roundNumber}`}
      sx={{listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: isDesktop ? "16px" : "10px", alignContent: "start"}}
    >
      {pairs.map((p) => (
        <Card component="li" key={p.id} sx={{display: "grid", gridTemplateColumns: "64px minmax(0,1fr)", overflow: "hidden", minHeight: 100}}>
          <Box sx={{background: color.cream, color: color.navy, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
            <Box component="span" sx={{fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase"}}>
              Stol
            </Box>
            <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 0.95}}>
              {p.table}
            </Box>
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", justifyContent: "center", px: "14px"}}>
            {[p.a, p.b].map((name, k) => (
              <Box key={k} sx={{height: 48, display: "flex", alignItems: "center", gap: "10px", borderTop: k ? `1px solid ${color.line}` : "none"}}>
                <Box component="span" aria-hidden sx={{width: 8, height: 8, flex: "none", borderRadius: "50%", background: k ? color.red : color.green}} />
                <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                  {name}
                </Box>
              </Box>
            ))}
          </Box>
        </Card>
      ))}
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell active="manageLeague" eyebrow={`Pairings · ${summary}`} title={`Round ${roundNumber}`}>
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>{list}</Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <ScreenTitle eyebrow={`Pairings${summary ? ` · ${summary}` : ""}`} title={`Round ${roundNumber}`} />
      <ScrollArea bleed>{list}</ScrollArea>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
    </Screen>
  );
}
