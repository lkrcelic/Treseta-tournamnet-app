"use client";

import {LeagueNightUpdate, MOVE_TO_PAST_ERROR, NIGHT_TAKEN, secondPlaceError} from "@/app/_interfaces/league";
import {effectiveTime, isIsoDate, NightLocation, nightLabelLong, ownTimeOf, sameLocation} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, ErrorNote, Eyebrow, mergeSx, OutlineButton, Segmented, SolidButton, TextField, TimeField} from "@/app/_ui/sp";
import {LocationPicker} from "@/app/_ui/locations/LocationPicker";
import AddLocationAltRoundedIcon from "@mui/icons-material/AddLocationAltRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";

// Okupljanje on the admin's screens: the league's default time and place (Nova liga, Podaci, Postavke) and a single
// night's date and own time and place (Datumi · Dodaj večer and Uredi večer).

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

// The night's date, times and places being edited (second_location: its Druga lokacija, null at one place)
export type NightForGathering = {date: string; start_time: string | null; gathering_time: string | null; location: NightLocation | null; second_location: NightLocation | null};

// Why a night can't go on the date typed (null: it can). A new night may be a past one (one played but not added); an
// existing one moves only to today or later.
export function nightDateError(date: string, today: string, taken: (date: string) => boolean, isNew: boolean): string | null {
  if (!isIsoDate(date)) return "Upiši datum večeri.";
  if (!isNew && date < today) return MOVE_TO_PAST_ERROR;
  return taken(date) ? NIGHT_TAKEN : null;
}

// A night's date and its own Okupljanje, Početak and place, and a second place played at the same time (Datumi: the
// desktop's card on the right, a sheet on the admin's phone; Claude Design 04 A). The times start as the night's (its
// own or the league's), the same at both places; the place is the league's or the night's own, so a new night starts
// with the league's (Podaci). Druga lokacija is added with Dodaj drugu lokaciju once the night has a place, and taken
// away with its ×. Uredi večer (an existing night): Spremi sends only what changed (a time equal to the league's and
// "Zadano lige" go back to the league's). Dodaj večer (isNew): Odustani and Dodaj večer, which sends the whole night.
// Give it key={night.date}, so another night starts afresh; savedAtStart: it opens as just saved (the night moved, so
// it came back under its new date). scrollFields: the form fills a tall sheet (the admin's phone), its fields scroll
// and the buttons stay under them, so Drugo mjesto, an error or the keyboard can't push Spremi off the sheet.
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
  splitHint = "Ekipe na lokacije raspoređuješ na kartici Podjela.",
  onSave,
  saving,
  error,
  savedAtStart = false,
  inputSx,
  scrollFields = false,
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
  // under Druga lokacija: where the teams are split between the two places
  splitHint?: string;
  // resolves to whether it was saved
  onSave: (change: LeagueNightUpdate) => Promise<boolean>;
  saving: boolean;
  error: string | null;
  savedAtStart?: boolean;
  inputSx?: SxProps<Theme>;
  scrollFields?: boolean;
  sx?: SxProps<Theme>;
  // under the buttons (the phone's Makni večer)
  children?: React.ReactNode;
}) {
  const [date, setDate] = useState(night.date);
  const [time, setTime] = useState(effectiveTime(night.start_time, leagueTime) ?? "");
  const [gathering, setGathering] = useState(effectiveTime(night.gathering_time, leagueGathering) ?? "");
  const [mode, setMode] = useState<Mode>(night.location ? "own" : "league");
  const [place, setPlace] = useState<NightLocation | null>(night.location);
  const [second, setSecond] = useState<NightLocation | null>(night.second_location);
  // Dodaj drugu lokaciju was pressed and no place is picked yet
  const [addingSecond, setAddingSecond] = useState(false);
  const [saved, setSaved] = useState(savedAtStart);

  const dateChanged = isNew || date !== night.date;
  // a new night's empty date isn't an error yet, only not ready
  const dateError = dateChanged && !(isNew && date === "") ? nightDateError(date, today, taken, isNew) : null;
  const ownTime = ownTimeOf(time, leagueTime);
  const ownGathering = ownTimeOf(gathering, leagueGathering);
  // an emptied time is the league's again, so the check is on the times the night will have
  const timeError = timesError(gathering || leagueGathering, time || leagueTime);
  const wantedPlace = mode === "own" ? place : null;
  const timeChanged = ownTime !== (night.start_time ?? null) || ownGathering !== (night.gathering_time ?? null);
  const placeChanged = mode === "own" ? !place || !sameLocation(place, night.location) : night.location != null;
  // where the night is played: its own place or the league's
  const firstPlace = mode === "own" ? place : leaguePlace;
  const secondChanged = !sameLocation(second, night.second_location);
  const secondError = secondPlaceError(firstPlace?.id, second?.id);
  const dirty = dateChanged || timeChanged || placeChanged || secondChanged;
  // Drugo mjesto needs a place picked
  const canSave = dirty && isIsoDate(date) && !dateError && !timeError && (mode === "league" || place != null) && !secondError && !saving;

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  const save = async () => {
    if (!canSave) return;
    if (isNew) {
      await onSave({date, start_time: ownTime, gathering_time: ownGathering, location_id: wantedPlace?.id ?? null, second_location_id: second?.id ?? null});
      return;
    }
    const change: LeagueNightUpdate = {};
    if (dateChanged) change.date = date;
    if (ownTime !== (night.start_time ?? null)) change.start_time = ownTime;
    if (ownGathering !== (night.gathering_time ?? null)) change.gathering_time = ownGathering;
    if (placeChanged) change.location_id = wantedPlace?.id ?? null;
    if (secondChanged) change.second_location_id = second?.id ?? null;
    if (await onSave(change)) setSaved(true);
  };

  const removeSecond = () => {
    setSecond(null);
    setAddingSecond(false);
    setSaved(false);
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        void save();
      }}
      sx={mergeSx({display: "flex", flexDirection: "column", gap: "14px", ...(scrollFields && {flex: 1, minHeight: 0})}, sx)}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          ...(scrollFields && {flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", mx: "-4px", px: "4px", pb: "4px"}),
        }}
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
          <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.muted, pl: "4px"}}>
            {timesHelp(gathering, time, leagueGathering, leagueTime)}
            {second && " Vrijeme je isto na obje lokacije."}
          </Box>
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
            <LocationPicker
              label="Lokacija večeri"
              value={place}
              onChange={changed(setPlace)}
              clearable={false}
              exclude={[leaguePlace?.id, second?.id].filter((id): id is number => id != null)}
            />
          )}
        </Box>
        {second || addingSecond ? (
          <LocationPicker
            label="Druga lokacija"
            placeholder="Odaberi drugu lokaciju"
            value={second}
            onChange={changed(setSecond)}
            clearable={false}
            defaultOpen={second == null}
            exclude={firstPlace?.id != null ? [firstPlace.id] : []}
            error={secondError ?? undefined}
            action={
              <Box
                component="button"
                type="button"
                aria-label="Makni drugu lokaciju"
                title="Makni drugu lokaciju"
                onClick={removeSecond}
                sx={{
                  ...buttonBase,
                  flex: "none",
                  width: 52,
                  minHeight: 52,
                  borderRadius: "14px",
                  background: color.white,
                  boxShadow: `inset 0 0 0 1.5px ${color.borderControl}`,
                  color: color.ink2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  "& svg": {fontSize: 22},
                  "&:hover": {background: color.paper2},
                }}
              >
                <CloseRoundedIcon />
              </Box>
            }
          />
        ) : (
          firstPlace && (
            <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <Box sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>Druga lokacija</Box>
              <Box
                component="button"
                type="button"
                onClick={() => setAddingSecond(true)}
                sx={{
                  ...buttonBase,
                  height: 52,
                  borderRadius: "14px",
                  border: `1.5px dashed ${color.borderControl}`,
                  color: color.navy,
                  fontSize: 15,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  "& svg": {fontSize: 22},
                  "&:hover": {background: color.paper2},
                }}
              >
                <AddLocationAltRoundedIcon aria-hidden />
                Dodaj drugu lokaciju
              </Box>
            </Box>
          )
        )}
        {second && <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.muted, pl: "4px", mt: "-6px"}}>{splitHint}</Box>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </Box>
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
        <SolidButton type="submit" height={52} disabled={!canSave} loading={saving} sx={{fontSize: 16, ...(saved && !dirty ? {opacity: 1} : {})}}>
          {saved && !dirty ? "Spremljeno ✓" : "Spremi"}
        </SolidButton>
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
// and where it was (both places of a two-place night), its rounds, why it can't change, then what can be done with it
// (children: Makni večer or Obriši večer i kola)
export function NightInfo({
  night,
  children,
}: {
  night: {date: string; played: boolean; rounds: number; time: string | null; gathering: string | null; place: NightLocation | null; second_location?: NightLocation | null};
  children?: React.ReactNode;
}) {
  const placeLine = (place: NightLocation) => (
    <>
      <b>{place.name}</b>
      {place.address && <Box component="span" sx={{color: color.muted}}>{` · ${place.address}`}</Box>}
    </>
  );
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
        {line(<PlaceRoundedIcon aria-hidden />, night.place ? placeLine(night.place) : "Bez mjesta")}
        {night.second_location && line(<PlaceRoundedIcon aria-hidden />, placeLine(night.second_location))}
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
