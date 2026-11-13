"use client";

import {restoreTableAPI, setTeamDayAPI} from "@/app/_fetchers/tournament";
import {AdminTournament, EntryExclusion, KoloView, TournamentEntryView} from "@/app/_interfaces/tournament";
import {clockLabel} from "@/app/_lib/gameTime";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet, ellipsis, Spinner, SwitchTrack} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TimerOffRoundedIcon from "@mui/icons-material/TimerOffRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// The admin's tournament day, on the phone and the computer (Claude Design "Turniri admin" M2d, M2x, M2xc, M7b, M8b;
// "Potvrda dolaska" AD1, AD2; "Nedolazak za stol" NA1): who has come (Tu / Nije potvrdila, Označi dolazak, Makni
// potvrdu), the Aktivna switch, Isključi ekipu and Vrati once it has started, and the tables' statuses.

export const clockOf = (iso: string) => new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(new Date(iso));

// The day has come: Tu smo is open, or the start time has passed before Kolo 1
export const dayOn = (t: AdminTournament) => t.phase === "upcoming" && t.day != null && t.day.phase !== "before";

// "Isključena · nedolazak K3", "Isključena · preskočen K2", "Isključena · K3"
export function exclusionLabel(x: EntryExclusion): string {
  const k = x.kolo ? ` K${x.kolo}` : "";
  return x.reason === "NO_SHOW" ? `Isključena · nedolazak${k}` : x.reason === "SKIPPED" ? `Isključena · preskočen${k}` : `Isključena${k ? ` ·${k}` : ""}`;
}

// "Isključena nakon Kola 3 · nedolazak" (Poredak)
export function exclusionAfter(x: EntryExclusion): string {
  const why = x.reason === "NO_SHOW" ? " · nedolazak" : x.reason === "SKIPPED" ? " · preskočen meč" : "";
  return `Isključena nakon Kola ${x.kolo ?? 1}${why}`;
}

// Tu (who and when) or Nije potvrdila
export function ArrivalChip({e, waiting = false}: {e: TournamentEntryView; waiting?: boolean}) {
  const here = e.arrival != null;
  const label = waiting ? `Lista čekanja ${e.position}. · ${here ? "Tu" : "nije potvrdila"}` : here ? "Tu" : "Nije potvrdila";
  return (
    <Box
      component="span"
      title={e.arrival ? `${e.arrival.admin ? "Označio organizator" : `Potvrdio ${e.arrival.by ?? "igrač"}`} u ${clockOf(e.arrival.at)}` : undefined}
      sx={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        height: 28,
        px: "9px",
        borderRadius: "9px",
        background: waiting ? (here ? tint.gold[16] : color.lineFill) : here ? tint.green[12] : color.lineFill,
        color: here ? (waiting ? color.ink : color.green) : color.muted,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
        "& svg": {fontSize: 16},
      }}
    >
      {waiting ? <HourglassTopRoundedIcon aria-hidden /> : here ? <HowToRegRoundedIcon aria-hidden /> : <RadioButtonUncheckedRoundedIcon aria-hidden />}
      {label}
    </Box>
  );
}

export function ExclusionTag({x}: {x: EntryExclusion}) {
  return (
    <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: "4px", fontSize: 13, fontWeight: 700, color: color.red, "& svg": {fontSize: 16}}}>
      {x.reason === "SKIPPED" ? <TimerOffRoundedIcon aria-hidden /> : <PersonOffRoundedIcon aria-hidden />}
      {exclusionLabel(x)}
    </Box>
  );
}

const textButton = {...buttonBase, flex: "none", height: 36, px: "10px", borderRadius: "10px", fontSize: 13.5, fontWeight: 700, color: color.navy, whiteSpace: "nowrap", "&:hover": {background: color.paper}} as const;

// The admin's buttons of one team on the day and after the start, with their requests; onChanged takes the answer
export function useTeamDay(t: AdminTournament, onChanged: (t: AdminTournament) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, teamId: number, body: {arrived?: boolean; active?: boolean; excluded?: boolean}) => {
    setBusy(key);
    setError(null);
    try {
      onChanged(await setTeamDayAPI(t.id, teamId, body));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promjena nije spremljena.");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return {busy, error, run, setError};
}

// Označi dolazak (a team without a phone) / Makni potvrdu
export function ArrivalButton({e, day}: {e: TournamentEntryView; day: ReturnType<typeof useTeamDay>}) {
  const key = `arrival-${e.team_id}`;
  return (
    <Box component="button" type="button" disabled={day.busy != null} onClick={() => day.run(key, e.team_id, {arrived: e.arrival == null})} sx={{...textButton, color: e.arrival ? color.muted : color.navy}}>
      {day.busy === key ? <Spinner size={16} /> : e.arrival ? "Makni potvrdu" : "Označi dolazak"}
    </Box>
  );
}

// Aktivna: the team plays the next Kolo (a waiting team switched on comes in)
export function ActiveSwitch({e, day}: {e: TournamentEntryView; day: ReturnType<typeof useTeamDay>}) {
  const key = `active-${e.team_id}`;
  const on = e.status === "REGISTERED" && e.active;
  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${e.team_name} igra sljedeće kolo`}
      disabled={day.busy != null}
      onClick={() => day.run(key, e.team_id, {active: !on})}
      sx={{...buttonBase, flex: "none", width: 56, height: 40, display: "flex", alignItems: "center", justifyContent: "center"}}
    >
      {day.busy === key ? <Spinner size={18} /> : <SwitchTrack on={on} onColor={color.green} />}
    </Box>
  );
}

// Isključi ekipu (once the tournament has started), asked first; Vrati brings an excluded team back
export function ExcludeControls({e, day, t}: {e: TournamentEntryView; day: ReturnType<typeof useTeamDay>; t: AdminTournament}) {
  const [asking, setAsking] = useState(false);
  const key = `exclude-${e.team_id}`;
  if (e.excluded) {
    return (
      <Box component="button" type="button" disabled={day.busy != null} onClick={() => day.run(key, e.team_id, {excluded: false})} sx={{...textButton, display: "flex", alignItems: "center", gap: "4px", "& svg": {fontSize: 18}}}>
        {day.busy === key ? <Spinner size={16} /> : <UndoRoundedIcon aria-hidden />}
        Vrati
      </Box>
    );
  }
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={`Isključi ${e.team_name} iz turnira`}
        onClick={() => {
          day.setError(null);
          setAsking(true);
        }}
        sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[10]}}}
      >
        <PersonRemoveRoundedIcon />
      </Box>
      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={async () => {
          if (await day.run(key, e.team_id, {excluded: true})) setAsking(false);
        }}
        title={`Isključiti ${e.team_name} iz turnira?`}
        text={`Ne igraju ostala kola. Odigrana kola ostaju u poretku. Ekipa neće dobiti obavijest. Možeš ih vratiti dok turnir traje.${t.waiting_list.some((w) => w.arrival) ? " Prva potvrđena ekipa s liste čekanja ulazi umjesto njih." : ""}`}
        action="Isključi ekipu"
        icon={<PersonRemoveRoundedIcon />}
        busy={day.busy === key}
        error={asking ? day.error : null}
      />
    </>
  );
}

// The navy card's numbers on the day (M2d, AD2): "Potvrda dolaska do 10:00 · još 8 min", "14 tu · 8 nije potvrdilo"
export function useMinutesLeft(iso: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 60_000));
}

export function ArrivalSummaryLine({t}: {t: AdminTournament}) {
  const left = useMinutesLeft(t.day?.closes ?? null);
  const s = t.arrival_summary;
  if (!t.day || !s) return null;
  const closes = clockOf(t.day.closes);
  return (
    <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
      <Box component="span" sx={{fontSize: 17, fontWeight: 700}}>
        {t.day.phase === "closed" ? `Potvrda dolaska zatvorena u ${closes}` : `Potvrda dolaska do ${closes}`}
      </Box>
      <Box component="span" sx={{fontSize: 14, color: color.cream}}>
        {s.here} tu · {s.not_confirmed} nije potvrdilo{t.day.phase === "open" && left != null ? ` · još ${left} min` : ""}
      </Box>
    </Box>
  );
}

// U 10:00: what the start time will do (AD1)
export function AtStartCard({t, sx}: {t: AdminTournament; sx?: object}) {
  const s = t.arrival_summary;
  if (!t.day || !s || t.day.phase === "closed" || t.phase !== "upcoming") return null;
  const lines: {icon: React.ReactNode; text: string}[] = [];
  if (s.will_be_inactive.length > 0) {
    lines.push({
      icon: <PersonOffRoundedIcon />,
      text: `${s.will_be_inactive.length} ${s.will_be_inactive.length === 1 ? "nepotvrđena ekipa postaje Neaktivna" : "nepotvrđenih ekipa postaje Neaktivno"} (ostaju prijavljene).`,
    });
  }
  if (s.will_come_in.length > 0) {
    lines.push({icon: <PlayArrowRoundedIcon />, text: `${s.will_come_in.join(", ")} (lista čekanja, tu) ${s.will_come_in.length === 1 ? "postaje Aktivna" : "postaju Aktivne"} umjesto neaktivnih.`});
  }
  if (lines.length === 0) lines.push({icon: <CheckCircleRoundedIcon />, text: "Sve prijavljene ekipe su potvrdile dolazak."});
  return (
    <Box component="section" aria-label={`U ${clockOf(t.day.closes)}`} sx={{flex: "none", p: "16px 18px", borderRadius: "22px", background: color.white, boxShadow: shadow.card, display: "flex", flexDirection: "column", gap: "10px", ...sx}}>
      <Box component="h2" sx={{m: 0, display: "flex", alignItems: "center", gap: "6px", fontFamily: font.display, fontSize: 19, fontWeight: 800, "& svg": {fontSize: 20, color: color.navy}}}>
        <ScheduleRoundedIcon aria-hidden />U {clockOf(t.day.closes)}
      </Box>
      {lines.map((l) => (
        <Box key={l.text} sx={{display: "flex", gap: "8px", fontSize: 14, lineHeight: 1.4, "& svg": {fontSize: 18, color: color.ink2, flex: "none", mt: "1px"}}}>
          {l.icon}
          <span>{l.text}</span>
        </Box>
      ))}
      <Box sx={{fontSize: 13, color: color.muted}}>„Označi dolazak” je za ekipe bez mobitela.</Box>
    </Box>
  );
}

// ---------- the tables' statuses (M7b, NA1) ----------

const STATE_TONE: Record<string, {bg: string; ink: string; icon: React.ReactNode}> = {
  asking: {bg: tint.gold[16], ink: color.ink, icon: <TimerRoundedIcon />},
  no_show: {bg: tint.red[10], ink: color.red, icon: <PersonOffRoundedIcon />},
  time_expired: {bg: tint.navy[10], ink: color.navy, icon: <TimerOffRoundedIcon />},
  skipped: {bg: color.lineFill, ink: color.ink2, icon: <TimerOffRoundedIcon />},
};

// The chip of a table with a status of the tournament day; "Upit · 1:52" counts down
export function StateChip({label, kind, skipAt}: {label: string; kind: string; skipAt?: string}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!skipAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [skipAt]);
  const tone = STATE_TONE[kind] ?? {bg: color.lineFill, ink: color.ink2, icon: null};
  const text = skipAt ? `Upit · ${clockLabel(Date.parse(skipAt) - now)}` : label;
  return (
    <Box component="span" sx={{flex: "none", display: "inline-flex", alignItems: "center", gap: "4px", height: 26, px: "8px", borderRadius: "8px", background: tone.bg, color: tone.ink, fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", "& svg": {fontSize: 15}}}>
      {tone.icon}
      {text}
    </Box>
  );
}

// The Kolo's tables whose day went other than a plain game (Upit, Nedolazak, Vrijeme isteklo, Preskočen), each with its
// line and a link to the table (the admin scorepad corrects the result). A skipped table and a no-show have Vrati stol.
export function TableStates({t, kolo, onChanged}: {t: AdminTournament; kolo: KoloView; onChanged: (t: AdminTournament) => void}) {
  const [restoring, setRestoring] = useState<KoloView["tables"][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async () => {
    if (!restoring) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await restoreTableAPI(t.id, restoring.id));
      setRestoring(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stol nije vraćen.");
    } finally {
      setBusy(false);
    }
  };
  const special = kolo.tables.filter((x) => x.state && ["asking", "no_show", "time_expired", "skipped"].includes(x.state.kind));
  if (special.length === 0) return null;
  return (
    <Box component="section" aria-label="Statusi stolova" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "20px", background: color.white, boxShadow: shadow.card, overflow: "hidden"}}>
        {special.map((x, i) => (
          <Box component="li" key={x.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
            <Box
              component={TransitionLink}
              href={`/turniri/${t.id}/stol/${x.id}`}
              sx={{display: "flex", alignItems: "center", gap: "10px", p: "12px 10px 12px 14px", color: color.ink, textDecoration: "none"}}
            >
              <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
                <Box sx={{display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap"}}>
                  <Box component="span" sx={{fontSize: 14, fontWeight: 800}}>
                    Stol {x.table_number}
                  </Box>
                  <StateChip label={x.state!.label} kind={x.state!.kind} skipAt={x.state!.skip_at} />
                </Box>
                <Box component="span" sx={{fontSize: 14, fontWeight: 600, ...ellipsis}}>
                  {x.team1.team_name} · {x.team2.team_name}
                </Box>
                {x.state!.note && (
                  <Box component="span" sx={{fontSize: 13, lineHeight: 1.4, color: color.ink2}}>
                    {x.state!.note}
                  </Box>
                )}
              </Box>
              <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy, flex: "none"}} />
            </Box>
            {(x.state!.kind === "skipped" || x.state!.kind === "no_show") && (
              <Box sx={{display: "flex", p: "0 10px 10px 8px"}}>
                <Box
                  component="button"
                  type="button"
                  aria-label={`Vrati Stol ${x.table_number} u igru`}
                  onClick={() => {
                    setError(null);
                    setRestoring(x);
                  }}
                  sx={{...textButton, display: "flex", alignItems: "center", gap: "4px", "& svg": {fontSize: 18}}}
                >
                  <UndoRoundedIcon aria-hidden />
                  Vrati stol
                </Box>
              </Box>
            )}
          </Box>
        ))}
      </Box>
      <ConfirmSheet
        open={restoring != null}
        onClose={() => setRestoring(null)}
        onConfirm={restore}
        title={restoring ? `Vratiti Stol ${restoring.table_number} u igru?` : ""}
        text={
          restoring
            ? `${restoring.team1.team_name} i ${restoring.team2.team_name} igraju ovaj stol kao da su potvrdili da su tu.${restoring.state?.kind === "no_show" ? " Upisani rezultat nedolaska se briše." : ""} Ekipe koje je ovaj stol isključio vraćaju se u turnir${kolo.number === 1 ? ", a zabrana prijava im se ukida" : ""}. Neobjavljena skica sljedećeg kola se briše i slaže ponovo kad kolo završi.`
            : ""
        }
        action="Vrati stol"
        icon={<UndoRoundedIcon />}
        busy={busy}
        error={restoring ? error : null}
      />
      <Box sx={{px: "4px", fontSize: 13, lineHeight: 1.4, color: color.muted}}>Ispravak rezultata odmah mijenja poredak i rejting, i nakon kraja turnira.</Box>
    </Box>
  );
}

// Poredak's excluded teams: they keep their place with their Kolos played, dimmed, with the reason
export function ExcludedStandings({t}: {t: AdminTournament}) {
  const out = t.results.standings.filter((s) => s.excluded);
  if (out.length === 0) return null;
  return (
    <Box component="section" aria-label="Isključene ekipe" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px", p: "12px 14px", borderRadius: "18px", background: color.lineFill}}>
      {out.map((s) => (
        <Box key={s.team_id} sx={{display: "flex", alignItems: "center", gap: "8px", fontSize: 14, opacity: 0.85, minWidth: 0}}>
          <Box component="span" sx={{fontWeight: 700, ...ellipsis}}>
            {t.results.standings.indexOf(s) + 1}. {s.team.team_name}
          </Box>
          <Box component="span" sx={{flex: "none", color: color.red, fontWeight: 600}}>
            {exclusionAfter(s.excluded!)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
