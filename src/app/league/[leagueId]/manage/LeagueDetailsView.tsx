"use client";

import {updateLeagueAPI} from "@/app/_fetchers/league/leagues";
import {LeagueOption, updateCachedLeague} from "@/app/_hooks/useLeagues";
import {END_DATE_ERROR, endsAfterStart, LEAGUE_NAME_TAKEN, leagueNameTaken, START_TIME_ERROR} from "@/app/_interfaces/league";
import {isStartTime} from "@/app/_lib/nights";
import {PlaceFields, placeOfDraft, placePayload, TIME_LABEL} from "@/app/_ui/admin/GatheringForm";
import {color, font, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, IconCircleButton, OutlineButton, PrimaryButton, TextField, TimeField} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";

export const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
export const DAY_NAMES = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];

// time: when the nights start, "HH:MM" ("": none); place, address, url: where they are played ("": none)
export type Details = {
  name: string;
  season: string;
  start: string;
  end: string;
  day: number | null;
  time: string;
  place: string;
  address: string;
  url: string;
  rounds: number;
};

const fromLeague = (l: LeagueOption | undefined): Details => ({
  name: l?.name ?? "",
  season: l?.season ?? "",
  start: l?.startDate ?? "",
  end: l?.endDate ?? "",
  day: l?.playDay ?? null,
  time: l?.startTime ?? "",
  place: l?.location?.name ?? "",
  address: l?.location?.address ?? "",
  url: l?.location?.url ?? "",
  rounds: l?.roundsPerNight ?? 3,
});

// The league's details being edited (Podaci on the desktop, Postavke on the admin's phone): the form's values over the
// league's, what is wrong with them, and saving. Save stays off until something changes; the name can't be empty or
// another league's (any case).
export function useLeagueDetails(leagueId: number, leagues: LeagueOption[]) {
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
      const place = {name: d.place, address: d.address, url: d.url};
      await updateLeagueAPI(leagueId, {
        league_name: name,
        season: d.season.trim() || null,
        start_date: d.start || null,
        end_date: d.end || null,
        play_day: d.day,
        start_time: d.time || null,
        ...placePayload(place),
        rounds_per_night: d.rounds,
      });
      updateCachedLeague(leagueId, {
        name,
        season: d.season.trim() || null,
        startDate: d.start || null,
        endDate: d.end || null,
        playDay: d.day,
        startTime: d.time || null,
        location: placeOfDraft(place),
        roundsPerNight: d.rounds,
      });
      setDraft({});
      setSaved(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Promjene lige nisu spremljene.");
    }
    setSaving(false);
  };

  const discard = () => {
    setDraft({});
    setServerError(null);
  };
  return {d, set, error, dirty, canSave, save, saving, saved, serverError, discard};
}

// Okupljanje of the league being edited: Vrijeme okupljanja, Ime mjesta, Adresa and Link na Google Mape, the defaults of
// every night (Podaci on the desktop, Postavke on the admin's phone). timeSx: the time field's box (narrower on the
// desktop).
export function LeagueGatheringFields({
  d,
  set,
  inputSx,
  timeSx,
}: {
  d: Details;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
  inputSx: SxProps<Theme>;
  timeSx?: SxProps<Theme>;
}) {
  return (
    <>
      <TimeField label={TIME_LABEL} value={d.time} onChange={(v) => set("time", v)} clearLabel="Ukloni vrijeme okupljanja" soft sx={timeSx} inputSx={inputSx} />
      <PlaceFields
        value={{name: d.place, address: d.address, url: d.url}}
        onChange={(p) => {
          if (p.name !== d.place) set("place", p.name);
          if (p.address !== d.address) set("address", p.address);
          if (p.url !== d.url) set("url", p.url);
        }}
        inputSx={inputSx}
      />
    </>
  );
}

// Upravljanje ligom (desktop) · Podaci: the league's name, season, dates, play day and default rounds per night, and on
// the right Okupljanje, the time and place of its nights; one Spremi promjene saves both. aside: under Okupljanje (the
// league's conferences).
export default function LeagueDetailsView({leagueId, leagues, aside}: {leagueId: number; leagues: LeagueOption[]; aside?: React.ReactNode}) {
  const {d, set, error, dirty, canSave, save, saving, saved, serverError, discard} = useLeagueDetails(leagueId, leagues);
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
              onClick={discard}
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
      <Box sx={{display: "flex", flexDirection: "column", gap: "20px", minWidth: 0}}>
        <Card component="section" aria-labelledby="ld-gathering" sx={{borderRadius: "24px", p: "26px"}}>
          <Box
            component="form"
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              save();
            }}
            noValidate
            sx={{display: "flex", flexDirection: "column", gap: "18px"}}
          >
            <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <Box component="h2" id="ld-gathering" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
                Okupljanje
              </Box>
              <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.muted}}>
                Zadano vrijeme i mjesto za sve večeri lige. Iznimku za pojedinu večer postavi u Datumima. Sprema se gumbom Spremi promjene.
              </Box>
            </Box>
            <LeagueGatheringFields d={d} set={set} inputSx={inputSx} timeSx={{maxWidth: "calc(50% - 6px)"}} />
          </Box>
        </Card>
        {aside}
      </Box>
    </Box>
  );
}
