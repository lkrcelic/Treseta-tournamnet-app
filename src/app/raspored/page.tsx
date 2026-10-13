"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useLeagues, {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import {leagueDateString} from "@/app/_lib/dates";
import {nextNightIndex, nightLabel, nightsCountLabel, nightsLeftLabel, RASPORED_PILL, rasporedPill, RasporedPill} from "@/app/_lib/nights";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopShell, ellipsis, EmptyState, ErrorNote, InitialsAvatar, PillTabs, Screen, Segmented, tabPanelProps, tabular, TopBar} from "@/app/_ui/sp";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useMemo} from "react";

// Raspored (Claude Design "Raspored lige"): the nights of the leagues the player plays in, the next one highlighted.
// A player without a team sees the league picked in the league menus. ?league= opens a league's tab.

type Shown = {
  leagueId: number;
  leagueName: string;
  team: string | null;
  players: {id: number; name: string; me: boolean}[];
  nights: string[];
  played: Set<string>;
  // the team's next night can get a substitute
  canAsk: boolean;
};

// A league tab's name: up to two lines, centred, then "…" (the whole name is its title)
const TAB_LABEL_SX = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "break-word",
  textAlign: "center",
  lineHeight: 1.2,
} as const;

// The pill colours: the next night navy, the season's last one cream, past nights plain
const PILL: Record<RasporedPill, {bg: string; ink: string}> = {
  played: {bg: "transparent", ink: color.muted},
  notPlayed: {bg: "transparent", ink: color.muted},
  tonight: {bg: color.navy, ink: color.white},
  next: {bg: color.navy, ink: color.white},
  last: {bg: color.cream, ink: color.navy},
};

export default function RasporedPage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const today = leagueDateString();
  const {schedule, error, reload} = useMySchedule();
  const leagues = useLeagues();
  const selected = useSelectedLeagueId();

  // one tab per league of the player's teams
  const mine = useMemo(
    () =>
      (schedule?.leagues ?? []).filter((l, i, all) => all.findIndex((o) => o.league_id === l.league_id) === i),
    [schedule]
  );
  const wanted = Number(params.get("league")) || null;
  const current = mine.find((l) => l.league_id === wanted) ?? mine[0] ?? null;
  // without a team: the picked league (or the one asked for)
  const otherId = schedule && !current ? wanted ?? selected ?? null : null;
  const other = useLeagueNights(otherId);

  let shown: Shown | null = null;
  if (current) {
    shown = {
      leagueId: current.league_id,
      leagueName: current.league_name,
      team: current.team_name,
      players: current.players,
      nights: current.nights,
      played: new Set(current.played),
      canAsk: current.active,
    };
  } else if (otherId != null && other.nights) {
    shown = {
      leagueId: otherId,
      leagueName: leagues.find((l) => l.id === otherId)?.name ?? "Liga",
      team: null,
      players: [],
      nights: other.nights.map((n) => n.date),
      played: new Set(other.nights.filter((n) => n.played).map((n) => n.date)),
      canAsk: false,
    };
  }

  const pick = (id: number) => router.router.replace(`/raspored?league=${id}`, {scroll: false});
  // League names often differ only at their end ("… Proljeće 25/26", "… Jesen 25/26"), so they are never cut short.
  // On the phone the leagues are pills in one row that scrolls sideways, like the rounds on Dnevni poredak; on the
  // desktop the strip is as wide as its names (wrapping onto a second line) and gives way to the title.
  const tabs =
    mine.length > 1 && !isDesktop ? (
      <PillTabs<number>
        items={mine.map((l) => ({key: l.league_id, label: l.league_name}))}
        value={current!.league_id}
        onChange={pick}
        label="Liga"
        idPrefix="raspored"
      />
    ) : mine.length > 1 ? (
      <Segmented<number>
        items={mine.map((l) => ({
          key: l.league_id,
          label: (
            <Box component="span" title={l.league_name} sx={TAB_LABEL_SX}>
              {l.league_name}
            </Box>
          ),
        }))}
        value={current!.league_id}
        onChange={pick}
        label="Liga"
        variant="track"
        size={44}
        idPrefix="raspored"
        sx={{
          "& [role=tab]": {fontSize: 15, height: "auto", minHeight: 44, whiteSpace: "normal", py: "5px", px: "16px"},
          width: "auto",
          maxWidth: "60vw",
          flex: "0 1 auto",
          minWidth: 0,
        }}
      />
    ) : null;

  const loadError = error ?? other.error;
  const loading = !schedule || (otherId != null && !other.nights);
  let body: React.ReactNode;
  if (loadError && !shown) body = <ErrorNote onRetry={error ? reload : other.reload}>{loadError}</ErrorNote>;
  else if (loading && !shown) body = <CenteredSpinner />;
  else if (!shown)
    body = (
      <Card>
        <EmptyState>Još nisi u nijednoj ligi, a nijedna liga nije odabrana.</EmptyState>
      </Card>
    );
  else body = <Schedule shown={shown} today={today} desktop={isDesktop} />;

  // with the league in the tabs, the eyebrow names only the team, so a long league name can't push it out
  const eyebrow = !shown ? "Liga" : tabs && shown.team ? shown.team : [shown.leagueName, shown.team].filter(Boolean).join(" · ");

  if (isDesktop) {
    return (
      <DesktopShell active="raspored" eyebrow={eyebrow} title="Raspored" right={tabs}>
        <Box {...(tabs ? tabPanelProps("raspored", current!.league_id) : {})} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
          {body}
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <TopBar eyebrow={eyebrow} title="Raspored" onBack={() => router.push("/", "back")} />
      {tabs}
      <Box {...(tabs ? tabPanelProps("raspored", current!.league_id) : {})} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
        {body}
      </Box>
    </Screen>
  );
}

function Schedule({shown, today, desktop}: {shown: Shown; today: string; desktop: boolean}) {
  const nextIndex = nextNightIndex(shown.nights, today);
  const next = nextIndex >= 0 ? shown.nights[nextIndex] : null;
  const playedCount = shown.nights.filter((n) => shown.played.has(n)).length;
  const left = nextIndex >= 0 ? shown.nights.length - nextIndex : 0;
  const hasNights = shown.nights.length > 0;
  // after the season the card shows the last night
  const cardNight = next ?? shown.nights[shown.nights.length - 1];
  const cardTitle = next === today ? "Večeras" : next ? "Sljedeća večer" : "Zadnja večer";

  // without nights the list says so, and there is no card
  const nextCard = hasNights && (
    <Box component="section" aria-label={cardTitle} sx={{flex: "none", borderRadius: "22px", background: color.navy, color: color.white, p: "16px 18px", display: "flex", alignItems: "center", gap: "14px"}}>
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="span" sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream}}>
          {cardTitle}
        </Box>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.05}}>
          {nightLabel(cardNight)}
        </Box>
        <Box component="span" sx={{fontSize: 14, color: color.cream}}>
          {nightsLeftLabel(left)}
        </Box>
      </Box>
      <EventRoundedIcon aria-hidden sx={{fontSize: 34, color: color.cream}} />
    </Box>
  );

  const ask = shown.canAsk && next && (
    <Box
      component={TransitionLink}
      href={`/burza/novi/zamjena?league=${shown.leagueId}&night=${next}`}
      sx={{...buttonBase, flex: "none", height: 52, borderRadius: "16px", border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 16, fontWeight: 600, textDecoration: "none", "& svg": {fontSize: 22}}}
    >
      <PersonSearchRoundedIcon aria-hidden />
      Nađi zamjenu
    </Box>
  );

  const list = (
    <Box sx={{flex: desktop ? 1 : "none", minHeight: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
      {hasNights && (
        <Box component="h2" sx={{m: 0, px: "6px", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
          {nightsCountLabel(shown.nights.length, playedCount)}
        </Box>
      )}
      <Card component="ol" sx={{listStyle: "none", m: 0, p: 0, overflowY: "auto", overscrollBehavior: "contain", flex: desktop ? 1 : "none", minHeight: 0}}>
        {!hasNights ? (
          <EmptyState>Admin još nije upisao večeri lige.</EmptyState>
        ) : (
          shown.nights.map((night, i) => {
            const isNext = i === nextIndex;
            const pill = rasporedPill(night, isNext, i === shown.nights.length - 1, today, shown.played.has(night));
            const past = night < today;
            return (
              <Box
                component="li"
                key={night}
                aria-current={isNext ? "date" : undefined}
                sx={{height: 56, display: "flex", alignItems: "center", gap: "12px", px: "16px", borderBottom: i < shown.nights.length - 1 ? `1px solid ${color.line}` : "none", background: isNext ? color.cream2 : "transparent", boxShadow: isNext ? shadow.mineBar : "none"}}
              >
                <Box component="span" sx={{width: 26, flex: "none", fontSize: 14, fontWeight: 700, color: color.muted, ...tabular}}>
                  {i + 1}
                </Box>
                <Box component="span" sx={{flex: 1, fontSize: 16, fontWeight: isNext ? 700 : 600, color: past ? color.muted : color.ink}}>
                  {nightLabel(night)}
                </Box>
                {pill && (
                  <Box
                    component="span"
                    sx={{
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      px: "10px",
                      borderRadius: "9px",
                      background: PILL[pill].bg,
                      color: PILL[pill].ink,
                      fontSize: 12.5,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {RASPORED_PILL[pill]}
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Card>
    </Box>
  );

  if (desktop) {
    return (
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "380px minmax(0,1fr)", gap: "20px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "16px", minHeight: 0, overflowY: "auto"}}>
          {nextCard}
          {shown.players.length > 0 && (
            <Card component="section" aria-label="Ekipa" sx={{p: "18px", display: "flex", flexDirection: "column", gap: "12px"}}>
              <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
                {shown.team}
              </Box>
              {shown.players.map((p) => (
                <Box key={p.id} sx={{display: "flex", alignItems: "center", gap: "10px", fontSize: 15}}>
                  <InitialsAvatar name={p.name} size={32} sx={{fontSize: 11}} />
                  <Box component="span" sx={ellipsis}>
                    {p.name}
                  </Box>
                  {p.me && (
                    <Box component="span" sx={{color: color.muted}}>
                      (ti)
                    </Box>
                  )}
                </Box>
              ))}
            </Card>
          )}
          {ask}
        </Box>
        {list}
      </Box>
    );
  }

  return (
    <>
      {nextCard}
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "10px", mx: "-20px", px: "20px", pb: "4px", "& > *": {flexShrink: 0}}}>
        {list}
        {ask}
      </Box>
    </>
  );
}
