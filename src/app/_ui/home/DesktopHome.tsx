"use client";

import {getPlayerByIdAPI} from "@/app/_fetchers/player/getById";
import useLeagues, {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMyTeams from "@/app/_hooks/useMyTeams";
import {useDailyData, useLeagueStandings, useRoundDates} from "@/app/_hooks/useStandings";
import {leagueDateString} from "@/app/_lib/dates";
import {currentLeagueHref} from "@/app/_lib/league";
import {splitPodium, toStandingsRows} from "@/app/_lib/ui/standings";
import {displayDate, weekdayDate} from "@/app/_lib/ui/text";
import useAuthStore from "@/app/_store/authStore";
import {color, font} from "@/app/_styles/tokens";
import {Card, ChipButton, DesktopShell, EmptyState, ErrorNote, LeagueMenuButton, LivePill, LoadingRows, Podium, StandingsGrid} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useEffect, useMemo, useState} from "react";

export default function DesktopHome() {
  const router = useTransitionRouter();
  const user = useAuthStore((s) => s.user);
  const [firstName, setFirstName] = useState<string | null>(null);
  const {teams} = useMyTeams();
  const myTeamNames = useMemo(() => teams.map((t) => t.team_name), [teams]);
  const leagues = useLeagues();
  // the league picked in the menu top right (shared with the other league screens), or the one being played now
  const leagueId = useSelectedLeagueId();
  const noLeague = leagueId === null;
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";

  useEffect(() => {
    if (!user?.id) return;
    getPlayerByIdAPI(user.id)
      .then((p) => setFirstName(p?.first_name ?? null))
      .catch(() => setFirstName(null));
  }, [user?.id]);

  // the latest night the league played; the card links to the full daily view
  const {dates} = useRoundDates(leagueId);
  const lastDate = noLeague ? "" : dates == null ? null : dates.length ? dates[dates.length - 1] : "";
  const daily = useDailyData(leagueId, lastDate || null);
  const dailyRows = useMemo(() => toStandingsRows(daily.data?.standings, myTeamNames), [daily.data, myTeamNames]);
  const liveRounds = (daily.data?.rounds ?? []).filter((r) => r.active).map((r) => r.round_number);
  const liveRound = liveRounds.length ? Math.max(...liveRounds) : null;

  const league = useLeagueStandings(leagueId);
  const leagueRows = useMemo(() => toStandingsRows(league.standings, myTeamNames), [league.standings, myTeamNames]);
  const {podium, rest} = splitPodium(leagueRows);

  const today = leagueDateString();
  const dailySub = !lastDate
    ? "Još nema okupljanja"
    : `${displayDate(lastDate)} · ${liveRound ? `Round ${liveRound} u tijeku` : lastDate === today ? "Večeras" : "Završeno"}`;

  // the picker remembers the pick itself (chooseLeague), and Početna follows it like the other league screens
  const picker = leagueId != null && leagues.length > 0 ? <LeagueMenuButton leagues={leagues} value={leagueId} onChange={() => undefined} /> : undefined;

  return (
    <DesktopShell
      active="home"
      eyebrow={weekdayDate(today)}
      title={firstName ? `Dobrodošao, ${firstName}` : "Dobrodošao"}
      right={picker}
    >
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "20px"}}>
        <Panel
          title="Daily Standings"
          sub={dailySub}
          badge={liveRound ? <LivePill /> : null}
          onOpen={() => router.push(currentLeagueHref("daily-standings", leagueId))}
        >
          {daily.error ? (
            <ErrorNote onRetry={daily.reload} sx={{m: "0 20px"}}>
              {daily.error}
            </ErrorNote>
          ) : lastDate === "" ? (
            <EmptyState>Liga još nije odigrala nijedno okupljanje.</EmptyState>
          ) : daily.loading && !daily.data ? (
            <LoadingRows rows={8} height={46} />
          ) : (
            <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", borderTop: `1px solid ${color.line}`}}>
              <StandingsGrid rows={dailyRows} dense caption={`Poredak okupljanja ${displayDate(lastDate)}`} />
            </Box>
          )}
        </Panel>

        <Panel title="League Standings" sub={leagueName} onOpen={() => router.push(currentLeagueHref("standings", leagueId))}>
          {league.error ? (
            <ErrorNote onRetry={league.reload} sx={{m: "0 20px"}}>
              {league.error}
            </ErrorNote>
          ) : league.loading && !noLeague ? (
            <LoadingRows rows={8} height={46} />
          ) : leagueRows.length === 0 ? (
            <EmptyState>Još nema rezultata u ovoj ligi.</EmptyState>
          ) : (
            <>
              <Podium rows={podium} compact sx={{px: "20px", pb: "14px"}} />
              <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", borderTop: `1px solid rgba(60,74,103,.1)`}}>
                <StandingsGrid rows={rest} columns={[]} dense showLive={false} caption="Ukupni poredak lige, od 4. mjesta" />
              </Box>
            </>
          )}
        </Panel>
      </Box>
    </DesktopShell>
  );
}

function Panel({
  title,
  sub,
  badge,
  onOpen,
  children,
}: {
  title: string;
  sub: string;
  badge?: React.ReactNode;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card component="section" aria-label={title} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", p: "18px 20px 12px", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
            {title}
          </Box>
          <Box sx={{fontSize: 14, color: color.muted}}>{sub}</Box>
        </Box>
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          {badge}
          <ChipButton onClick={onOpen} aria-label={`Otvori ${title}`}>
            Otvori
            <ChevronRightRoundedIcon />
          </ChipButton>
        </Box>
      </Box>
      {children}
    </Card>
  );
}
