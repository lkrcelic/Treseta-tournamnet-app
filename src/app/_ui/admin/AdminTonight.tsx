"use client";

import useAdminViewStore from "@/app/_store/adminViewStore";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useLeagueRounds from "@/app/_hooks/useLeagueRounds";
import useLeagues, {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import {useDailyData} from "@/app/_hooks/useStandings";
import {leagueNightString} from "@/app/_lib/dates";
import {nightLabel, nightLabelLong, nightsLeftLabel} from "@/app/_lib/nights";
import {draftNight, tonightEyebrow, tonightState, TonightState, waitingLabel} from "@/app/_lib/ui/adminTonight";
import {toTableRows, TableRow} from "@/app/_lib/ui/tables";
import {count, NOUN} from "@/app/_lib/ui/text";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import LeagueNotes from "@/app/_ui/round/LeagueNotes";
import {buttonBase, ellipsis, EmptyState, ErrorNote, IconCircleButton, LeagueEyebrowButton, PrimaryButton, Screen, Spinner, tabular} from "@/app/_ui/sp";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {Box} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import {AdminTabBar} from "./AdminTabBar";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Večer lige (admin-mobile 01): the admin's home on the phone while the league plays. The league is picked in the
// eyebrow (and holds for every admin screen), "Prikaz igrača" switches to the app players see. The navy card shows
// how tonight is going, the cream one which night's rounds wait to be published, then the four ways on, the tables
// still playing and the league's notes.
export default function AdminTonight() {
  const router = useTransitionRouter();
  const setView = useAdminViewStore((s) => s.setView);
  const leagueId = useSelectedLeagueId();
  const leagues = useLeagues(leagueId ?? undefined);
  const league = leagues.find((l) => l.id === leagueId);
  // the night Novo kolo is for: until 06:00 it is still the evening before
  const tonight = useMemo(() => leagueNightString(), []);
  const {nights} = useLeagueNights(leagueId);
  const daily = useDailyData(leagueId, leagueId != null ? tonight : null);
  const leagueRounds = useLeagueRounds(leagueId);

  // when the tables last came in (every 30 s, and on Osvježi)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  useEffect(() => {
    if (daily.data) setRefreshedAt(hhmm(new Date()));
  }, [daily.data]);

  const rows: (TableRow & {round: number})[] = useMemo(() => {
    const rounds = daily.data?.rounds ?? [];
    const roundOf = new Map(rounds.map((r) => [r.id, r.round_number]));
    return toTableRows(rounds).map((t) => ({...t, round: roundOf.get(t.id) ?? 0}));
  }, [daily.data]);
  // tonight's rounds, unpublished ones too, for "Kolo 2 od 3"
  const roundsTonight = new Set((leagueRounds.rounds ?? []).filter((r) => r.date === tonight).map((r) => r.roundNumber)).size;
  const state = tonightState(rows, roundsTonight);
  const draft = draftNight(leagueRounds.rounds);
  const waiting = draft && draft.waiting > 0 ? draft : null;
  const tonightNight = nights?.find((n) => n.date === tonight) ?? null;
  const nextNight = nights?.find((n) => n.date >= tonight) ?? null;
  const time = tonightNight?.time ?? null;

  if (leagueId === null) {
    return (
      <Screen gap={14}>
        <Box component="h1" sx={{m: 0, px: "4px", fontFamily: font.display, fontSize: 32, fontWeight: 800, letterSpacing: "-.02em"}}>
          Večer lige
        </Box>
        <EmptyState>Još nema nijedne lige.</EmptyState>
        <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={() => router.push("/league/new")}>
          Nova liga
        </PrimaryButton>
        <AdminTabBar active="vecer" />
      </Screen>
    );
  }

  const base = leagueId != null ? `/league/${leagueId}` : null;
  const current = state.kind === "playing" ? rows.filter((t) => t.round === state.round) : [];
  const playingTeams = current.reduce((n, t) => n + (t.bye ? 1 : 2), 0);
  const sub =
    state.kind === "none"
      ? nextNight
        ? [nightLabelLong(nextNight.date), nextNight.time, league?.teamCount != null ? count(league.teamCount, NOUN.ekipa) : null]
        : [nightsLeftLabel(0)]
      : [nightLabelLong(tonight), state.kind === "playing" ? count(playingTeams, NOUN.ekipa) : null, state.kind === "playing" ? count(state.tables, NOUN.stol) : null];
  const stillPlaying = current.filter((t) => !t.done);

  const refresh = () => {
    daily.refresh();
    leagueRounds.reload();
  };

  return (
    <Screen gap={14}>
      <Box component="header" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px", px: "4px"}}>
        {/* the league's name has the whole width (the title's row has Prikaz igrača) */}
        {leagueId != null && leagues.length > 0 ? (
          <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={() => undefined} onNewLeague={() => router.push("/league/new")} />
        ) : (
          <Box sx={{height: 24}} />
        )}
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minWidth: 0}}>
          <Box
            component="h1"
            sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em", whiteSpace: "nowrap", "@media (min-width: 375px)": {fontSize: 32}}}
          >
            Večer lige
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => setView("player")}
            title="Prebaci na prikaz igrača"
            sx={{
              ...buttonBase,
              height: 44,
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              p: "0 14px 0 10px",
              borderRadius: "22px",
              background: color.white,
              color: color.navy,
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: shadow.raised,
              "& svg": {fontSize: 20},
            }}
          >
            <SwapHorizRoundedIcon aria-hidden />
            Prikaz igrača
          </Box>
        </Box>
      </Box>
      {leagueId != null && (
        <Box sx={{flex: "none", px: "4px", mt: "-6px", fontSize: 15, color: color.muted}}>{sub.filter(Boolean).join(" · ")}</Box>
      )}

      {daily.error && !daily.data ? (
        <ErrorNote onRetry={daily.reload}>{daily.error}</ErrorNote>
      ) : leagueId === undefined || daily.loading || leagueRounds.rounds == null ? (
        <Box sx={{height: 196, flex: "none", borderRadius: "24px", background: color.navy, display: "flex", alignItems: "center", justifyContent: "center"}}>
          <Spinner tone="white" label="Učitavanje" />
        </Box>
      ) : (
        <NightCard
          state={state}
          time={time}
          tonight={nextNight?.date === tonight}
          nextNight={nextNight?.date ?? null}
          draftTonight={waiting?.date === tonight ? waitingLabel(waiting.waiting, waiting.approved) : null}
          onDaily={() => router.push(`${base}/daily-standings`)}
          onCreate={() => router.push(`${base}/manage?view=create`)}
          onDraft={() => router.push(`${base}/manage?view=draft&date=${tonight}`)}
        />
      )}

      {waiting && base && !(state.kind === "none" && waiting.date === tonight) && (
        <Box
          component={TransitionLink}
          href={`${base}/manage?view=draft&date=${waiting.date}`}
          sx={{
            ...buttonBase,
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            p: "16px",
            borderRadius: "22px",
            background: color.cream,
            color: color.ink,
            textAlign: "left",
            textDecoration: "none",
          }}
        >
          <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}>
            <EditCalendarRoundedIcon />
          </Box>
          <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
              Skica čeka objavu
            </Box>
            <Box component="span" sx={{fontSize: 13.5, color: color.ink2}}>
              {waiting.date === tonight ? waitingLabel(waiting.waiting, waiting.approved) : `${nightLabel(waiting.date)} · ${waitingLabel(waiting.waiting, waiting.approved)}`}
            </Box>
          </Box>
          <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy}} />
        </Box>
      )}

      {base && (
        <Box component="nav" aria-label="Večer" sx={{flex: "none", display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "10px"}}>
          <Tile href={`${base}/standings`} icon={<EmojiEventsRoundedIcon />} label="Ukupni poredak" />
          <Tile
            href={`${base}/manage?view=draft${draft ? `&date=${draft.date}` : ""}`}
            icon={<EditCalendarRoundedIcon />}
            label="Skica kola"
            badge={waiting ? waiting.waiting : null}
          />
          <Tile href={`${base}/daily-standings`} icon={<CalendarMonthRoundedIcon />} label="Dnevni poredak" />
          <Tile href={`${base}/manage?view=teams`} icon={<TuneRoundedIcon />} label="Upravljanje ligom" />
        </Box>
      )}

      {state.kind === "playing" && stillPlaying.length > 0 && base && (
        <Box component="section" aria-labelledby="jos-igraju" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
          <Box sx={{pl: "6px", display: "flex", alignItems: "center", gap: "8px"}}>
            <Box component="h2" id="jos-igraju" sx={{m: 0, flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
              Još igraju
            </Box>
            {refreshedAt && (
              <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                Osvježeno {refreshedAt}
              </Box>
            )}
            <IconCircleButton label="Osvježi" size={44} onClick={refresh} sx={{"& svg": {fontSize: 22}}}>
              <RefreshRoundedIcon />
            </IconCircleButton>
          </Box>
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
            {stillPlaying.map((t, i) => (
              <Box component="li" key={t.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                <Box
                  component={TransitionLink}
                  href={`${base}/daily-standings/table/${t.id}`}
                  aria-label={`Stol ${t.table}: ${t.teamA} – ${t.teamB}${t.live ? `, ${t.pointsA} : ${t.pointsB}` : ""}`}
                  sx={{
                    ...buttonBase,
                    width: "100%",
                    minHeight: 68,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    p: "10px 12px 10px 16px",
                    color: color.ink,
                    textAlign: "left",
                    textDecoration: "none",
                    "&:active": {background: color.paper2},
                  }}
                >
                  <Box component="span" aria-hidden sx={{width: 36, height: 36, flex: "none", borderRadius: "10px", background: color.paper, color: color.navy, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", ...tabular}}>
                    {t.table}
                  </Box>
                  <Box component="span" aria-hidden sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", fontSize: 15, fontWeight: 600}}>
                    <Box component="span" sx={ellipsis}>
                      {t.teamA}
                    </Box>
                    <Box component="span" sx={ellipsis}>
                      {t.teamB}
                    </Box>
                  </Box>
                  <Box component="span" aria-hidden sx={{flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", ...tabular}}>
                    {t.live && t.pointsA != null ? (
                      <>
                        <Box component="span" sx={{color: color.green}}>
                          {t.pointsA}
                        </Box>
                        <Box component="span" sx={{color: color.red}}>
                          {t.pointsB}
                        </Box>
                      </>
                    ) : (
                      <Box component="span" sx={{fontSize: 13, fontWeight: 600, color: t.live ? color.red : color.muted}}>
                        {t.live ? "Uživo" : "Nije počelo"}
                      </Box>
                    )}
                  </Box>
                  <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {leagueId != null && (
        <LeagueNotes leagueId={leagueId} label="Bilješke lige" sx={{flex: "none", minHeight: 0, "& textarea": {minHeight: 96, flex: "none", borderRadius: "22px"}}} />
      )}

      <AdminTabBar active="vecer" />
    </Screen>
  );
}

// The navy card: the round being played ("8 / 10 stolova završeno"), a finished night, or a night without published
// rounds (with Novo kolo, or Skica kola while tonight's rounds wait)
function NightCard({
  state,
  time,
  tonight,
  nextNight,
  draftTonight,
  onDaily,
  onCreate,
  onDraft,
}: {
  state: TonightState;
  time: string | null;
  // tonight is one of the league's nights
  tonight: boolean;
  nextNight: string | null;
  // tonight's rounds wait to be published: how many ("3 kola nisu objavljena · 1 odobreno")
  draftTonight: string | null;
  onDaily: () => void;
  onCreate: () => void;
  onDraft: () => void;
}) {
  const eyebrow =
    state.kind === "playing"
      ? tonightEyebrow(state)
      : state.kind === "finished"
        ? "Večer je odigrana"
        : tonight
          ? "Večeras"
          : nextNight
            ? "Sljedeća večer"
            : "Sezona";
  const big =
    state.kind === "playing" ? (
      <>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 44, fontWeight: 800, lineHeight: 0.9, whiteSpace: "nowrap", ...tabular}}>
          {state.done} / {state.tables}
        </Box>
        <Box component="span" sx={{fontSize: 16, color: color.cream}}>
          {state.done === 1 ? "stol završen" : "stolova završeno"}
        </Box>
      </>
    ) : state.kind === "finished" ? (
      <>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 44, fontWeight: 800, lineHeight: 0.9, whiteSpace: "nowrap", ...tabular}}>
          {state.rounds} / {state.rounds}
        </Box>
        <Box component="span" sx={{fontSize: 16, color: color.cream}}>
          kola odigrano
        </Box>
      </>
    ) : (
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.01em"}}>
          {draftTonight ? "Kola čekaju objavu" : tonight ? "Kola još nisu kreirana" : nextNight ? nightLabel(nextNight) : "Nema više večeri"}
        </Box>
        {draftTonight && (
          <Box component="span" sx={{fontSize: 15, color: color.cream}}>
            {draftTonight}
          </Box>
        )}
      </Box>
    );
  const pct = state.kind === "playing" ? Math.round((state.done / Math.max(state.tables, 1)) * 100) : state.kind === "finished" ? 100 : null;
  const action =
    state.kind !== "none"
      ? {label: "Dnevni poredak", icon: <CalendarMonthRoundedIcon />, onClick: onDaily}
      : draftTonight
        ? {label: "Skica kola", icon: <EditCalendarRoundedIcon />, onClick: onDraft}
        : {label: "Novo kolo", icon: <AddCircleRoundedIcon />, onClick: onCreate};
  return (
    <Box component="section" aria-label="Večeras" sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px 20px", display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
        <Box component="span" sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream, ...ellipsis}}>
          {eyebrow}
        </Box>
        {time && (state.kind !== "none" || tonight) && (
          <Box component="span" sx={{flex: "none", fontSize: 13, color: color.cream}}>
            od {time}
          </Box>
        )}
      </Box>
      <Box sx={{display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap"}}>{big}</Box>
      {pct != null && (
        <Box role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Završeno" sx={{height: 8, borderRadius: "4px", background: tint.creamOnNavy[24], overflow: "hidden"}}>
          <Box sx={{height: "100%", width: `${pct}%`, borderRadius: "4px", background: color.cream, transition: "width 400ms ease"}} />
        </Box>
      )}
      <Box
        component="button"
        type="button"
        onClick={action.onClick}
        sx={{
          ...buttonBase,
          height: 48,
          borderRadius: "14px",
          background: color.cream,
          color: color.navy,
          fontSize: 16,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          "& svg": {fontSize: 22},
          "&:active": {transform: "scale(.98)"},
        }}
      >
        {action.icon}
        {action.label}
      </Box>
    </Box>
  );
}

// One of the four ways on from Večer (a white tile, the Skica one with a red count)
function Tile({href, icon, label, badge}: {href: string; icon: React.ReactNode; label: string; badge?: number | null}) {
  return (
    <Box
      component={TransitionLink}
      href={href}
      aria-label={badge ? `${label}, ${count(badge, NOUN.neobjavljenoKolo)}` : undefined}
      sx={{
        ...buttonBase,
        position: "relative",
        height: 84,
        boxSizing: "border-box",
        borderRadius: "20px",
        background: color.white,
        color: color.ink,
        p: "14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-start",
        fontSize: 15,
        fontWeight: 600,
        textAlign: "left",
        textDecoration: "none",
        boxShadow: shadow.card,
        "& > svg": {fontSize: 26, color: color.navy},
        "&:active": {transform: "scale(.98)"},
      }}
    >
      {icon}
      {label}
      {badge ? (
        <Box
          component="span"
          aria-hidden
          sx={{position: "absolute", top: 12, right: 12, minWidth: 24, height: 24, px: "7px", boxSizing: "border-box", borderRadius: "12px", background: color.red, color: color.white, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          {badge}
        </Box>
      ) : null}
    </Box>
  );
}
