"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import {useTournaments} from "@/app/_hooks/useTournaments";
import {TournamentCard} from "@/app/_interfaces/tournament";
import {leagueDateString} from "@/app/_lib/dates";
import {capacityLabel, liveDayLabel, liveProgressLabel, liveTournaments, monthLabel, upcomingTournaments} from "@/app/_lib/tournaments";
import {count, NOUN, plural} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, tint} from "@/app/_styles/tokens";
import {Card, Display, EmptyState, ErrorNote, LiveDot, LoadingRows, StackTopBar, ellipsis} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {Box} from "@mui/material";
import React from "react";
import PlayerFrame from "./PlayerFrame";
import {tournamentHref} from "./PlayerParts";
import {DateTile} from "./TournamentParts";

// Uživo and Nadolazeći turniri, each on its own page from Početna's rows, built as Završeni turniri (FinishedPage): the
// title, a line under it, the tournaments in groups (by day, by month), each row opening the tournament's page.

type Group = {label: string; items: TournamentCard[]};

function groupBy(list: TournamentCard[], label: (t: TournamentCard) => string): Group[] {
  const groups: Group[] = [];
  for (const t of list) {
    const l = label(t);
    const last = groups[groups.length - 1];
    if (last?.label === l) last.items.push(t);
    else groups.push({label: l, items: [t]});
  }
  return groups;
}

// The page around the groups, as FinishedPage: the top bar back to Turniri, the title and its line, loading, an error,
// nothing yet, or the groups
function ListPage({title, line, empty, groups, loaded, error, reload, row}: {
  title: string;
  line: string | null;
  empty: string;
  groups: Group[];
  loaded: boolean;
  error: string | null;
  reload: () => void;
  row: (t: TournamentCard) => React.ReactNode;
}) {
  const nav = useNavStack(title, "/turniri");
  return (
    <PlayerFrame>
      <StackTopBar eyebrow="Turniri" nav={nav} />
      <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
        <Display size={30} sx={{lineHeight: 1.05}}>
          {title}
        </Display>
        {loaded && line && (
          <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
            {line}
          </Box>
        )}
      </Box>
      {error && !loaded ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !loaded ? (
        <Card>
          <LoadingRows rows={4} height={68} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState>{empty}</EmptyState>
        </Card>
      ) : (
        groups.map((g) => (
          <Box key={g.label} component="section" aria-label={g.label} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
            <Box component="h2" sx={{m: 0, px: "4px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
              {g.label}
            </Box>
            <Card component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden", borderRadius: "22px"}}>
              {g.items.map((t, i) => (
                <Box component="li" key={t.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  {row(t)}
                </Box>
              ))}
            </Card>
          </Box>
        ))
      )}
    </PlayerFrame>
  );
}

// One row: the tile, the name and its line, what is on the right, the chevron; the whole row opens the tournament
function Row({t, tile, meta, right, mine = false}: {t: TournamentCard; tile: React.ReactNode; meta: React.ReactNode; right?: React.ReactNode; mine?: boolean}) {
  return (
    <Box
      component={TransitionLink}
      href={tournamentHref(t.id)}
      sx={{minHeight: 72, display: "flex", alignItems: "center", gap: "12px", px: "14px", py: "8px", color: color.ink, textDecoration: "none", background: mine ? color.cream2 : "transparent", "&:active": {background: color.paper2}}}
    >
      {tile}
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700, ...ellipsis}}>
          {t.name}
        </Box>
        {meta}
      </Box>
      {right}
      <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
    </Box>
  );
}

const metaSx = {display: "flex", alignItems: "center", gap: "5px", fontSize: 13, color: color.muted, minWidth: 0} as const;

// The Kolo being played (or the last one played) in a tile the size of the date's
function KoloTile({n}: {n: number}) {
  return (
    <Box aria-hidden sx={{flex: "none", width: 44, height: 48, borderRadius: "12px", background: tint.red[10], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, gap: "3px"}}>
      <Box component="span" sx={{fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", color: color.red}}>
        KOLO
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 19, fontWeight: 800, color: color.ink}}>
        {n}
      </Box>
    </Box>
  );
}

// The viewer's own tournament: Tvoj (their team plays) or Čekaš (on the waiting list)
function MineBadge({t}: {t: TournamentCard}) {
  if (!t.me) return null;
  if (t.me.status === "WAITING") return <Status icon={<HourglassTopRoundedIcon aria-hidden />} label="Čekaš" tone={color.medal[0]} />;
  return (
    <Box component="span" sx={{flex: "none", height: 30, px: "10px", display: "flex", alignItems: "center", borderRadius: "10px", background: color.navy, color: color.white, fontFamily: font.display, fontSize: 15, fontWeight: 800}}>
      Tvoj
    </Box>
  );
}

function Status({icon, label, tone}: {icon: React.ReactNode; label?: string; tone: string}) {
  return (
    <Box component="span" sx={{flex: "none", display: "flex", alignItems: "center", gap: "4px", fontSize: 13, fontWeight: 700, color: tone, "& svg": {fontSize: 19}}}>
      {icon}
      {label}
    </Box>
  );
}

// Uživo (/turniri/uzivo): every tournament being played, for anyone; the viewer's own first, then by day
export function LivePage() {
  const {tournaments, error, reload} = useTournaments(30_000);
  const today = leagueDateString();
  const live = liveTournaments(tournaments ?? []);
  const mine = live.filter((t) => t.me);
  const groups = mine.length > 0 ? [{label: "Tvoj turnir", items: mine}, ...groupBy(live.filter((t) => !t.me), (t) => liveDayLabel(t.date, today))] : groupBy(live, (t) => liveDayLabel(t.date, today));
  return (
    <ListPage
      title="Uživo"
      line={live.length > 0 ? `${count(live.length, ["turnir", "turnira", "turnira"])} se ${plural(live.length, "igra", "igraju", "igra")}` : null}
      empty="Trenutno se ne igra nijedan turnir."
      groups={groups.filter((g) => g.items.length > 0)}
      loaded={tournaments != null}
      error={error}
      reload={reload}
      row={(t) => (
        <Row
          t={t}
          mine={t.me?.status === "REGISTERED"}
          tile={<KoloTile n={t.live_kolo ?? t.completed_kolos} />}
          meta={
            <Box component="span" sx={{...metaSx, color: t.live_kolo ? color.red : color.muted, fontWeight: t.live_kolo ? 600 : 400}}>
              {t.live_kolo != null && <LiveDot size={7} />}
              <Box component="span" sx={ellipsis}>
                {[liveProgressLabel(t), count(t.teams, NOUN.ekipa)].filter(Boolean).join(" · ")}
              </Box>
            </Box>
          }
          right={<MineBadge t={t} />}
        />
      )}
    />
  );
}

// Nadolazeći turniri (/turniri/nadolazeci): every one still coming up, the soonest first, by month; on the right
// whether the viewer is in (Prijavljeni, Čekaš) or the sign-ups are closed. Prijavi se is on the tournament's page.
export function UpcomingPage() {
  const {tournaments, error, reload} = useTournaments();
  const today = leagueDateString();
  const upcoming = upcomingTournaments(tournaments ?? [], today);
  const signedUp = upcoming.filter((t) => t.me).length;
  return (
    <ListPage
      title="Nadolazeći turniri"
      line={signedUp > 0 ? `Prijavljen si na ${signedUp} od ${upcoming.length}` : null}
      empty="Još nema nadolazećih turnira. Kad se objavi novi, ovdje se možeš prijaviti."
      groups={groupBy(upcoming, (t) => monthLabel(t.date, today))}
      loaded={tournaments != null}
      error={error}
      reload={reload}
      row={(t) => (
        <Row
          t={t}
          tile={<DateTile date={t.date} size={44} />}
          meta={
            <Box component="span" sx={{...metaSx, ...ellipsis, display: "block"}}>
              {[t.start_time, t.location.name, t.max_teams == null ? count(t.teams, NOUN.ekipa) : capacityLabel(t.teams, t.max_teams)].filter(Boolean).join(" · ")}
            </Box>
          }
          right={
            t.me?.status === "REGISTERED" ? (
              <Status icon={<CheckCircleRoundedIcon aria-label="Prijavljeni" />} tone={color.green} />
            ) : t.me?.status === "WAITING" ? (
              <Status icon={<HourglassTopRoundedIcon aria-hidden />} label="Čekaš" tone={color.medal[0]} />
            ) : !t.signups_open_now ? (
              <Status icon={<LockRoundedIcon aria-label="Prijave zatvorene" />} tone={color.muted} />
            ) : null
          }
        />
      )}
    />
  );
}
