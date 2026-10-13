"use client";

import {updateLeagueAPI} from "@/app/_fetchers/league/leagues";
import {LeagueOption, updateCachedLeague} from "@/app/_hooks/useLeagues";
import {END_DATE_ERROR, endsAfterStart, LEAGUE_NAME_TAKEN, leagueNameTaken, START_TIME_ERROR} from "@/app/_interfaces/league";
import {isStartTime} from "@/app/_lib/nights";
import {color, font, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, IconCircleButton, OutlineButton, PrimaryButton, TextField, TimeField} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";

const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const DAY_NAMES = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];

// time: when the nights start, "HH:MM" ("": none)
type Details = {name: string; season: string; start: string; end: string; day: number | null; time: string; rounds: number};

const fromLeague = (l: LeagueOption | undefined): Details => ({
  name: l?.name ?? "",
  season: l?.season ?? "",
  start: l?.startDate ?? "",
  end: l?.endDate ?? "",
  day: l?.playDay ?? null,
  time: l?.startTime ?? "",
  rounds: l?.roundsPerNight ?? 3,
});

// Upravljanje ligom (desktop) · Podaci: the league's name, season, dates, play day, start time and default rounds per
// night. Save stays off until something changes; the name can't be empty or another league's (any case). aside: the
// second column (the league's conferences).
export default function LeagueDetailsView({leagueId, leagues, aside}: {leagueId: number; leagues: LeagueOption[]; aside?: React.ReactNode}) {
  const base = fromLeague(leagues.find((l) => l.id === leagueId));
  const [draft, setDraft] = useState<Partial<Details>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const d: Details = {...base, ...draft};
  const set = <K extends keyof Details>(k: K, v: Details[K]) => {
    setDraft((p) => ({...p, [k]: v}));
    setSaved(false);
    setServerError(null);
  };

  const name = d.name.trim();
  const duplicate = leagueNameTaken(leagues, name, leagueId);
  const error = !name
    ? "Ime lige je obavezno."
    : duplicate
      ? LEAGUE_NAME_TAKEN
      : !d.start
        ? "Početak je obavezan."
        : !endsAfterStart(d.start, d.end)
          ? END_DATE_ERROR
          : d.time && !isStartTime(d.time)
            ? START_TIME_ERROR
            : "";
  const dirty = (Object.keys(base) as (keyof Details)[]).some((k) => String(base[k]) !== String(d[k]));
  const canSave = dirty && !error && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      await updateLeagueAPI(leagueId, {
        league_name: name,
        season: d.season.trim() || null,
        start_date: d.start || null,
        end_date: d.end || null,
        play_day: d.day,
        start_time: d.time || null,
        rounds_per_night: d.rounds,
      });
      updateCachedLeague(leagueId, {
        name,
        season: d.season.trim() || null,
        startDate: d.start || null,
        endDate: d.end || null,
        playDay: d.day,
        startTime: d.time || null,
        roundsPerNight: d.rounds,
      });
      setDraft({});
      setSaved(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Promjene lige nisu spremljene.");
    }
    setSaving(false);
  };

  const inputSx = {height: 52, borderRadius: "14px", fontSize: 16};

  return (
    <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "20px", alignContent: "start"}}>
      <Card component="section" aria-labelledby="ld-title" sx={{borderRadius: "24px", p: "26px"}}>
        <Box
          component="form"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            save();
          }}
          noValidate
          sx={{display: "flex", flexDirection: "column", gap: "18px"}}
        >
          <Box component="h2" id="ld-title" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
            Podaci lige
          </Box>
          <TextField label="Ime lige" placeholder="npr. Proljetna liga 2026" value={d.name} onChange={(e) => set("name", e.target.value)} soft inputSx={inputSx} />
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,.7fr) minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
            <TextField label="Sezona" placeholder="2026" inputMode="numeric" value={d.season} onChange={(e) => set("season", e.target.value)} soft inputSx={inputSx} />
            <TextField label="Početak" type="date" value={d.start} onChange={(e) => set("start", e.target.value)} soft inputSx={inputSx} />
            <TextField label="Kraj" type="date" value={d.end} min={d.start || undefined} onChange={(e) => set("end", e.target.value)} soft inputSx={inputSx} />
          </Box>
          <Box role="radiogroup" aria-labelledby="ld-day" sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
            <Box id="ld-day" sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
              Dan igranja · neobavezno
            </Box>
            <Box sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: "6px"}}>
              {DAYS.map((label, i) => (
                <Box
                  key={label}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={d.day === i}
                  aria-label={DAY_NAMES[i]}
                  onClick={() => set("day", d.day === i ? null : i)}
                  sx={{
                    ...buttonBase,
                    height: 48,
                    borderRadius: "12px",
                    background: d.day === i ? color.navy : color.paper,
                    color: d.day === i ? color.white : color.navy,
                    fontSize: 14,
                    fontWeight: 700,
                    transition: "background 160ms ease",
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", alignItems: "end"}}>
            <TimeField label="Početak večeri · neobavezno" value={d.time} onChange={(v) => set("time", v)} clearLabel="Ukloni početak večeri" soft inputSx={inputSx} />
            <Box sx={{fontSize: 13, lineHeight: 1.45, color: color.muted, pb: "6px"}}>Zadano za sve večeri. Pojedinoj večeri promijeni ga na kartici Datumi.</Box>
          </Box>
          <Box role="group" aria-labelledby="ld-rpn" sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", p: "12px 14px", borderRadius: "16px", background: color.paper2}}>
            <Box sx={{display: "flex", flexDirection: "column"}}>
              <Box id="ld-rpn" component="span" sx={{fontSize: 15, fontWeight: 600}}>
                Kola po večeri
              </Box>
              <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                Zadano za novo kolo
              </Box>
            </Box>
            <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
              <IconCircleButton label="Manje kola po večeri" size={44} onClick={() => set("rounds", Math.max(1, d.rounds - 1))} disabled={d.rounds <= 1} sx={{borderRadius: "12px", "& svg": {fontSize: 22}}}>
                <RemoveRoundedIcon />
              </IconCircleButton>
              <Box component="output" aria-live="polite" sx={{minWidth: 28, textAlign: "center", fontFamily: font.display, fontSize: 28, fontWeight: 800}}>
                {d.rounds}
              </Box>
              <IconCircleButton label="Više kola po večeri" size={44} onClick={() => set("rounds", Math.min(6, d.rounds + 1))} disabled={d.rounds >= 6} sx={{borderRadius: "12px", "& svg": {fontSize: 22}}}>
                <AddRoundedIcon />
              </IconCircleButton>
            </Box>
          </Box>
          {error && dirty && (
            <Box role="alert" sx={{fontSize: 14, fontWeight: 600, color: color.red, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
              <ErrorRoundedIcon />
              {error}
            </Box>
          )}
          {serverError && <ErrorNote>{serverError}</ErrorNote>}
          <Box sx={{display: "flex", gap: "10px", alignItems: "center"}}>
            <OutlineButton
              height={56}
              onClick={() => {
                setDraft({});
                setServerError(null);
              }}
              disabled={!dirty || saving}
              sx={{flex: 1, fontSize: 16, border: `1.5px solid ${tint.navy[25]}`, "&:disabled": {opacity: 0.4}}}
            >
              Odbaci promjene
            </OutlineButton>
            <PrimaryButton type="submit" disabled={!canSave} loading={saving} sx={{flex: 1}}>
              {!dirty && saved ? "Spremljeno ✓" : "Spremi promjene"}
            </PrimaryButton>
          </Box>
        </Box>
      </Card>
      {aside}
    </Box>
  );
}
