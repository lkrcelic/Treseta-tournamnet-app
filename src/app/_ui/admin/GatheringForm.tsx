"use client";

import {LeagueNightUpdate, MOVE_TO_PAST_ERROR, NIGHT_TAKEN} from "@/app/_interfaces/league";
import {effectiveTime, isIsoDate, NightLocation, nightLabelLong, ownTimeOf, sameLocation} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {ErrorNote, Eyebrow, mergeSx, OutlineButton, Segmented, SolidButton, TextField, TimeField} from "@/app/_ui/sp";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";

// Okupljanje on the admin's screens: the league's default time and place (Nova liga, Podaci, Postavke) and a single
// night's date and own time and place (Datumi · Dodaj večer and Uredi večer).

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

// Okupljanje and Početak side by side, as in Novi turnir: when the people start coming and when the night starts (the
// main time: Raspored, Početna and Tu smo count from it). Both optional; error goes under Okupljanje.
export function TimesFields({
  gathering,
  start,
  onGathering,
  onStart,
  error,
  inputSx,
}: {
  gathering: string;
  start: string;
  onGathering: (v: string) => void;
  onStart: (v: string) => void;
  error?: string;
  inputSx?: SxProps<Theme>;
}) {
  return (
    <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px", alignItems: "start"}}>
      <TimeField label="Okupljanje" value={gathering} onChange={onGathering} clearLabel="Ukloni vrijeme okupljanja" soft inputSx={inputSx} error={error} />
      <TimeField label="Početak" value={start} onChange={onStart} clearLabel="Ukloni početak" soft inputSx={inputSx} />
    </Box>
  );
}

// Okupljanje after Početak (both "HH:MM") can't be (undefined: it's fine, or either is missing)
export const timesError = (gathering: string | null | undefined, start: string | null | undefined) =>
  gathering && start && gathering >= start ? "Okupljanje mora biti prije početka." : undefined;

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

// Under a night's Okupljanje and Početak: "Zadano za ligu: okupljanje 18:30, početak 19:00." and, when the night has a
// time of its own, "Ova večer ima svoje vrijeme."
export function timesHelp(gathering: string, start: string, leagueGathering: string | null, leagueStart: string | null): string {
  const league = [leagueGathering && `okupljanje ${leagueGathering}`, leagueStart && `početak ${leagueStart}`].filter(Boolean).join(", ");
  const own = ownTimeOf(gathering, leagueGathering) != null || ownTimeOf(start, leagueStart) != null;
  return `${league ? `Zadano za ligu: ${league}.` : "Liga nema zadano vrijeme."}${own ? " Ova večer ima svoje vrijeme." : ""}`;
}

// The night's date, times and place being edited
export type NightForGathering = {date: string; start_time: string | null; gathering_time: string | null; location: NightLocation | null};

// Why a night can't go on the date typed (null: it can). A new night may be a past one (one played but not added); an
// existing one moves only to today or later.
export function nightDateError(date: string, today: string, taken: (date: string) => boolean, isNew: boolean): string | null {
  if (!isIsoDate(date)) return "Upiši datum večeri.";
  if (!isNew && date < today) return MOVE_TO_PAST_ERROR;
  return taken(date) ? NIGHT_TAKEN : null;
}

// A night's date and its own Okupljanje, Početak and place (Datumi: the desktop's card on the right, a sheet on the
// admin's phone). The times start as the night's (its own or the league's); the place is the league's or the night's
// own, so a new night starts with the league's (Podaci). Uredi večer (an existing night): Spremi sends only what changed
// (a time equal to the league's and "Zadano lige" go back to the league's), and Vrati na zadano takes the night's own
// times and place away (the date stays). Dodaj večer (isNew): Odustani and Dodaj večer, which sends the whole night. Give it
// key={night.date}, so another night starts afresh; savedAtStart: it opens as just saved (the night moved, so it came
// back under its new date).
export function NightGatheringForm({
  night,
  isNew = false,
  onCancel,
  today,
  taken,
  leagueTime,
  leagueGathering,
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
  isNew?: boolean;
  // Dodaj večer's Odustani
  onCancel?: () => void;
  // the league's today: a night moves to it or later
  today: string;
  // whether the league already has a night on that date
  taken: (date: string) => boolean;
  // the league's Početak and Okupljanje
  leagueTime: string | null;
  leagueGathering: string | null;
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
  const [gathering, setGathering] = useState(effectiveTime(night.gathering_time, leagueGathering) ?? "");
  const [mode, setMode] = useState<Mode>(night.location ? "own" : "league");
  const [place, setPlace] = useState<PlaceDraft>(placeDraftOf(night.location));
  const [saved, setSaved] = useState(savedAtStart);

  const dateChanged = isNew || date !== night.date;
  // a new night's empty date isn't an error yet, only not ready
  const dateError = dateChanged && !(isNew && date === "") ? nightDateError(date, today, taken, isNew) : null;
  const ownTime = ownTimeOf(time, leagueTime);
  const ownGathering = ownTimeOf(gathering, leagueGathering);
  // an emptied time is the league's again, so the check is on the times the night will have
  const timeError = timesError(gathering || leagueGathering, time || leagueTime);
  const wantedPlace = mode === "own" ? placeOfDraft(place) : null;
  const timeChanged = ownTime !== (night.start_time ?? null) || ownGathering !== (night.gathering_time ?? null);
  const placeChanged = mode === "own" ? !place.name.trim() || !sameLocation(wantedPlace, night.location) : night.location != null;
  const dirty = dateChanged || timeChanged || placeChanged;
  // a place of its own needs a name
  const canSave = dirty && isIsoDate(date) && !dateError && !timeError && (mode === "league" || !!place.name.trim()) && !saving;
  const hasOwn = night.start_time != null || night.gathering_time != null || night.location != null;

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  const save = async () => {
    if (!canSave) return;
    if (isNew) {
      await onSave({date, start_time: ownTime, gathering_time: ownGathering, location: wantedPlace});
      return;
    }
    const change: LeagueNightUpdate = {};
    if (dateChanged) change.date = date;
    if (ownTime !== (night.start_time ?? null)) change.start_time = ownTime;
    if (ownGathering !== (night.gathering_time ?? null)) change.gathering_time = ownGathering;
    if (placeChanged) change.location = wantedPlace;
    if (await onSave(change)) setSaved(true);
  };

  const reset = async () => {
    setTime(leagueTime ?? "");
    setGathering(leagueGathering ?? "");
    setMode("league");
    setPlace(EMPTY_PLACE);
    setSaved(false);
    if (hasOwn && (await onSave({start_time: null, gathering_time: null, location: null}))) setSaved(true);
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
      <TextField
        label="Datum večeri"
        type="date"
        value={date}
        min={isNew ? undefined : today}
        onChange={(e) => changed(setDate)(e.target.value)}
        error={dateError ?? undefined}
        soft
        inputSx={inputSx}
      />
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <TimesFields gathering={gathering} start={time} onGathering={changed(setGathering)} onStart={changed(setTime)} error={timeError} inputSx={inputSx} />
        <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.muted, pl: "4px"}}>{timesHelp(gathering, time, leagueGathering, leagueTime)}</Box>
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
      {isNew ? (
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
          <OutlineButton height={52} onClick={onCancel} disabled={saving} sx={{fontSize: 16, borderWidth: "1.5px", borderColor: color.borderControl, color: color.navy}}>
            Odustani
          </OutlineButton>
          <SolidButton type="submit" height={52} disabled={!canSave} loading={saving} sx={{fontSize: 16}}>
            Dodaj večer
          </SolidButton>
        </Box>
      ) : (
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
          <OutlineButton height={52} onClick={reset} disabled={saving || (!hasOwn && !dirty)} sx={{fontSize: 16, borderWidth: "1.5px", borderColor: color.borderControl, color: color.navy}}>
            Vrati na zadano
          </OutlineButton>
          <SolidButton type="submit" height={52} disabled={!canSave} loading={saving} sx={{fontSize: 16, ...(saved && !dirty ? {opacity: 1} : {})}}>
            {saved && !dirty ? "Spremljeno ✓" : "Spremi"}
          </SolidButton>
        </Box>
      )}
      {children}
    </Box>
  );
}

// The desktop card of Datumi: UREDI VEČER (or another eyebrow) and the night's long date, or a title of its own (Nova
// večer), then the form
export function NightGatheringHeading({date, eyebrow = "Uredi večer", title}: {date?: string; eyebrow?: string; title?: string}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
      <Eyebrow sx={{fontSize: 12.5, fontWeight: 700}}>{eyebrow}</Eyebrow>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        {title ?? (date ? nightLabelLong(date) : "")}
      </Box>
    </Box>
  );
}

// A night that keeps its date, time and place (it has passed or has rounds), as Datumi shows it when it is opened: when
// and where it was, its rounds, why it can't change, then what can be done with it (children: Makni večer or Obriši
// večer i kola)
export function NightInfo({
  night,
  children,
}: {
  night: {date: string; played: boolean; rounds: number; time: string | null; gathering: string | null; place: NightLocation | null};
  children?: React.ReactNode;
}) {
  const line = (icon: React.ReactNode, text: React.ReactNode) => (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", minHeight: 24, fontSize: 15, color: color.ink, "& > svg": {flex: "none", fontSize: 22, color: color.navy}}}>
      {icon}
      <Box component="span" sx={{minWidth: 0}}>
        {text}
      </Box>
    </Box>
  );
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "14px"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "14px", background: color.paper2, border: `1px solid ${color.line}`}}>
        {line(
          <ScheduleRoundedIcon aria-hidden />,
          night.time || night.gathering ? [night.time && `Početak ${night.time}`, night.gathering && `okupljanje od ${night.gathering}`].filter(Boolean).join(" · ") : "Bez vremena"
        )}
        {line(
          <PlaceRoundedIcon aria-hidden />,
          night.place ? (
            <>
              <b>{night.place.name}</b>
              {night.place.address && <Box component="span" sx={{color: color.muted}}>{` · ${night.place.address}`}</Box>}
            </>
          ) : (
            "Bez mjesta"
          )
        )}
        {line(<TableRestaurantRoundedIcon aria-hidden />, night.played ? count(night.rounds, NOUN.odigranoKolo) : "Nije odigrana")}
      </Box>
      <Box sx={{fontSize: 13.5, lineHeight: 1.45, color: color.muted, pl: "4px"}}>
        {night.played
          ? "Odigrana večer više se ne mijenja. Može se obrisati, ali samo zajedno sa svojim kolima i rezultatima."
          : "Večer je prošla bez kola i više se ne mijenja. Može se samo maknuti s popisa."}
      </Box>
      {children}
    </Box>
  );
}
