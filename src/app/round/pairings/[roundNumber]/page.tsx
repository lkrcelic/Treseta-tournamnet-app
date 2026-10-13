"use client";

import {getRoundsByRoundNumber} from "@/app/_fetchers/round/getRoundsByRoundNumber";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {teamLabel} from "@/app/_lib/bye";
import type {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";
import {count, displayDate, NOUN} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {Card, DesktopShell, ellipsis, EmptyState, ErrorNote, LoadingRows, PrimaryButton, Screen, ScreenTitle, ScrollArea, TeamDot} from "@/app/_ui/sp";
import useConferences from "@/app/_hooks/useConferences";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import useLeagues, {useActiveLeagueId} from "@/app/_hooks/useLeagues";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useEffect, useState} from "react";

type Pairing = {id: number; table: number; smoking: boolean; a: string; b: string; aId: number; bId: number};

// Who sits where in a new round, shown right after the admin creates it. The dots are the teams' conferences, or
// green and red in a league without conferences.
export default function RoundPairings() {
  const {roundNumber} = useParams<{roundNumber: string}>();
  const fromUrl = Number(useSearchParams().get("league")) || null;
  const activeId = useActiveLeagueId();
  const leagueId = fromUrl ?? activeId;
  const leagueName = useLeagues().find((l) => l.id === leagueId)?.name;
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const [pairs, setPairs] = useState<Pairing[] | null>(null);
  const [date, setDate] = useState<string | null>(null); // "dd.mm." of the night
  const [error, setError] = useState<string | null>(null);
  const conferences = useConferences(leagueId);

  const load = useCallback(async () => {
    if (leagueId === undefined) return; // still finding the league being played now
    setError(null);
    try {
      const data = leagueId == null ? [] : await getRoundsByRoundNumber(Number(roundNumber), leagueId);
      const night = data?.find((r) => r.round_date)?.round_date;
      setDate(night ? displayDate(String(night)).slice(0, 6) : null);
      setPairs(
        (data ?? [])
          .map((r: RoundMatchup, i: number) => ({
            id: r.id,
            table: r.table_number || i + 1,
            smoking: !!r.smoking_table,
            a: teamLabel(r.team1?.team_id, r.team1?.team_name ?? ""),
            b: teamLabel(r.team2?.team_id, r.team2?.team_name ?? ""),
            aId: r.team1?.team_id ?? -1,
            bId: r.team2?.team_id ?? -1,
          }))
          .sort((x, y) => x.table - y.table)
      );
    } catch {
      setError("Parove nije moguće učitati.");
    }
  }, [roundNumber, leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  // as designed: "Parovi · <liga>" over "Kolo 3 · 17.02."
  const eyebrow = leagueName ? `Parovi · ${leagueName}` : "Parovi";
  const title = date ? `Kolo ${roundNumber} · ${date}` : `Kolo ${roundNumber}`;

  const list = error ? (
    <ErrorNote onRetry={load}>{error}</ErrorNote>
  ) : !pairs || !conferences.ready ? (
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
      aria-label={`Parovi, kolo ${roundNumber}, ${count(pairs.length, NOUN.stol)}`}
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
            {p.smoking && <SmokingMark sx={{mt: "6px", background: color.white}} />}
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", justifyContent: "center", px: "14px"}}>
            {(
              [
                [p.a, p.aId],
                [p.b, p.bId],
              ] as const
            ).map(([name, teamId], k) => {
              const conference = conferences.of(teamId);
              return (
                <Box key={k} sx={{height: 48, display: "flex", alignItems: "center", gap: "10px", borderTop: k ? `1px solid ${color.line}` : "none"}}>
                  {conference === undefined ? (
                    <TeamDot color={k ? color.red : color.green} />
                  ) : (
                    <TeamDot color={conference?.color ?? null} label={conference?.name} />
                  )}
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                    {name}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Card>
      ))}
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell active="manageLeague" eyebrow={eyebrow} title={title}>
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>{list}</Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <ScreenTitle eyebrow={eyebrow} title={title} />
      <ScrollArea bleed>{list}</ScrollArea>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
    </Screen>
  );
}
