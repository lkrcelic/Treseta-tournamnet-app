"use client";

import {LeagueNightUpdate, MOVE_TO_PAST_ERROR, NIGHT_TAKEN} from "@/app/_interfaces/league";
import {effectiveTime, isIsoDate, NightLocation, nightLabelLong, ownTimeOf, sameLocation} from "@/app/_lib/nights";
import {color, font} from "@/app/_styles/tokens";
import {ErrorNote, Eyebrow, mergeSx, OutlineButton, Segmented, SolidButton, TextField, TimeField} from "@/app/_ui/sp";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";

// Okupljanje on the admin's screens: the league's default time and place (Nova liga, Podaci, Postavke) and a single
// night's date and own time and place (Datumi · Uredi večer).

// A place being typed: the three fields as they are ("" for an empty one)
export type PlaceDraft = {name: string; address: string; url: string};

export const EMPTY_PLACE: PlaceDraft = {name: "", address: "", url: ""};

export const placeDraftOf = (loc: NightLocation | null | undefined): PlaceDraft => ({name: loc?.name ?? "", address: loc?.address ?? "", url: loc?.url ?? ""});

// What the league's place is saved as: an empty field is null
export const placePayload = (p: PlaceDraft) => ({
  location_name: p.name.trim() || null,
  location_address: p.address.trim() || null,
  location_url: p.url.trim() || null,
});

// The place a draft stands for (null without a name)
export function placeOfDraft(p: PlaceDraft): NightLocation | null {
  const {location_name, location_address, location_url} = placePayload(p);
  return location_name ? {name: location_name, address: location_address, url: location_url} : null;
}

export const TIME_LABEL = "Vrijeme okupljanja · neobavezno";

// Ime mjesta, Adresa and Link na Google Mape, in that order (no help text: the link is only checked to be http(s), and
// a wrong one is said in the form's error note)
export function PlaceFields({
  value,
  onChange,
  inputSx,
  soft = true,
  gap = "14px",
}: {
  value: PlaceDraft;
  onChange: (p: PlaceDraft) => void;
  inputSx?: SxProps<Theme>;
  soft?: boolean;
  gap?: string;
}) {
  const set = (k: keyof PlaceDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({...value, [k]: e.target.value});
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap}}>
      <TextField label="Ime mjesta" placeholder="npr. Caffe bar Kartaš" maxLength={100} value={value.name} onChange={set("name")} soft={soft} inputSx={inputSx} />
      <TextField label="Adresa" placeholder="npr. Ilica 128, Zagreb" maxLength={200} value={value.address} onChange={set("address")} soft={soft} inputSx={inputSx} />
      <TextField
        label="Link na Google Mape"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://maps.app.goo.gl/…"
        maxLength={500}
        value={value.url}
        onChange={set("url")}
        soft={soft}
        inputSx={inputSx}
      />
    </Box>
  );
}

// The league's place in Okupljanje večeri: a pin, its name and address (or that it has none)
function LeaguePlaceBox({place}: {place: NightLocation | null}) {
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "12px 14px", borderRadius: "14px", background: color.paper2, border: `1px solid ${color.line}`}}>
      <PlaceRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />
      {place ? (
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
            {place.name}
          </Box>
          {place.address && (
            <Box component="span" sx={{fontSize: 13, color: color.muted}}>
              {place.address}
            </Box>
          )}
        </Box>
      ) : (
        <Box component="span" sx={{fontSize: 14, color: color.muted}}>
          Liga nema zadano mjesto.
        </Box>
      )}
    </Box>
  );
}

type Mode = "league" | "own";
const MODES: {key: Mode; label: string}[] = [
  {key: "league", label: "Zadano lige"},
  {key: "own", label: "Drugo mjesto"},
];

// "Zadano za ligu: 19:30", or with a time of its own "Zadano za ligu je 19:30, ova večer počinje u 20:00."
export function timeHelp(time: string, leagueTime: string | null): string {
  const own = ownTimeOf(time, leagueTime);
  if (!leagueTime) return own ? `Liga nema zadano vrijeme, ova večer počinje u ${own}.` : "Liga nema zadano vrijeme.";
  return own ? `Zadano za ligu je ${leagueTime}, ova večer počinje u ${own}.` : `Zadano za ligu: ${leagueTime}`;
}

// The night's date, time and place being edited
export type NightForGathering = {date: string; start_time: string | null; location: NightLocation | null};

// Why a night can't move to the date typed (null: it can)
export function moveDateError(date: string, today: string, taken: (date: string) => boolean): string | null {
  if (!isIsoDate(date)) return "Upiši datum večeri.";
  if (date < today) return MOVE_TO_PAST_ERROR;
  return taken(date) ? NIGHT_TAKEN : null;
}

// A night's date and its own time and place (Uredi večer: the desktop's card in Datumi, the sheet of Datumi on the
// admin's phone). The time starts as the night's (its own or the league's); the place is the league's or the night's
// own. Spremi sends only what changed (a time equal to the league's and "Zadano lige" go back to the league's), and Vrati
// na zadano takes the night's own time and place away (the date stays). Give it key={night.date}, so another night starts
// afresh; savedAtStart: it opens as just saved (the night moved, so it came back under its new date).
export function NightGatheringForm({
  night,
  today,
  taken,
  leagueTime,
  leaguePlace,
  settingsTab,
  onSave,
  saving,
  error,
  savedAtStart = false,
  inputSx,
  sx,
  children,
}: {
  night: NightForGathering;
  // the league's today: a night moves to it or later
  today: string;
  // whether the league already has a night on that date
  taken: (date: string) => boolean;
  leagueTime: string | null;
  leaguePlace: NightLocation | null;
  // where the league's own time and place are changed: "Podaci" (desktop) or "Postavke" (phone)
  settingsTab: string;
  // resolves to whether it was saved
  onSave: (change: LeagueNightUpdate) => Promise<boolean>;
  saving: boolean;
  error: string | null;
  savedAtStart?: boolean;
  inputSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  // under the buttons (the phone's Makni večer)
  children?: React.ReactNode;
}) {
  const [date, setDate] = useState(night.date);
  const [time, setTime] = useState(effectiveTime(night.start_time, leagueTime) ?? "");
  const [mode, setMode] = useState<Mode>(night.location ? "own" : "league");
  const [place, setPlace] = useState<PlaceDraft>(placeDraftOf(night.location));
  const [saved, setSaved] = useState(savedAtStart);

  const dateChanged = date !== night.date;
  const dateError = dateChanged ? moveDateError(date, today, taken) : null;
  const ownTime = ownTimeOf(time, leagueTime);
  const wantedPlace = mode === "own" ? placeOfDraft(place) : null;
  const timeChanged = ownTime !== (night.start_time ?? null);
  const placeChanged = mode === "own" ? !place.name.trim() || !sameLocation(wantedPlace, night.location) : night.location != null;
  const dirty = dateChanged || timeChanged || placeChanged;
  // a place of its own needs a name
  const canSave = dirty && !dateError && (mode === "league" || !!place.name.trim()) && !saving;
  const hasOwn = night.start_time != null || night.location != null;

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  const save = async () => {
    if (!canSave) return;
    const change: LeagueNightUpdate = {};
    if (dateChanged) change.date = date;
    if (timeChanged) change.start_time = ownTime;
    if (placeChanged) change.location = wantedPlace;
    if (await onSave(change)) setSaved(true);
  };

  const reset = async () => {
    setTime(leagueTime ?? "");
    setMode("league");
    setPlace(EMPTY_PLACE);
    setSaved(false);
    if (hasOwn && (await onSave({start_time: null, location: null}))) setSaved(true);
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        void save();
      }}
      sx={mergeSx({display: "flex", flexDirection: "column", gap: "14px"}, sx)}
    >
      <TextField label="Datum večeri" type="date" value={date} min={today} onChange={(e) => changed(setDate)(e.target.value)} error={dateError ?? undefined} soft inputSx={inputSx} />
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <TimeField label={TIME_LABEL} value={time} onChange={changed(setTime)} clearLabel="Ukloni vrijeme okupljanja" soft inputSx={inputSx} />
        <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.muted, pl: "4px"}}>{timeHelp(time, leagueTime)}</Box>
      </Box>
      <Box role="group" aria-labelledby={`place-${night.date}`} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <Box id={`place-${night.date}`} sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
          Mjesto
        </Box>
        <Segmented<Mode> items={MODES} value={mode} onChange={changed<Mode>(setMode)} label="Mjesto večeri" variant="track" asTabs={false} size={40} />
        {mode === "league" ? (
          <>
            <LeaguePlaceBox place={leaguePlace} />
            <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.muted, pl: "4px"}}>Zadano vrijeme i mjesto lige mijenjaju se na kartici {settingsTab}.</Box>
          </>
        ) : (
          <PlaceFields value={place} onChange={changed(setPlace)} inputSx={inputSx} gap="12px" />
        )}
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
        <OutlineButton height={52} onClick={reset} disabled={saving || (!hasOwn && !dirty)} sx={{fontSize: 16, borderWidth: "1.5px", borderColor: color.borderControl, color: color.navy}}>
          Vrati na zadano
        </OutlineButton>
        <SolidButton type="submit" height={52} disabled={!canSave} loading={saving} sx={{fontSize: 16, ...(saved && !dirty ? {opacity: 1} : {})}}>
          {saved && !dirty ? "Spremljeno ✓" : "Spremi"}
        </SolidButton>
      </Box>
      {children}
    </Box>
  );
}

// The desktop card of Datumi: UREDI VEČER, the night's long date, then the form
export function NightGatheringHeading({date}: {date: string}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
      <Eyebrow sx={{fontSize: 12.5, fontWeight: 700}}>Uredi večer</Eyebrow>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        {nightLabelLong(date)}
      </Box>
    </Box>
  );
}
