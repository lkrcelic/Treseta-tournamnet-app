"use client";

import {addLeagueNightAPI, removeLeagueNightAPI, setLeagueNightTimeAPI} from "@/app/_fetchers/league/nights";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import {updateCachedLeague} from "@/app/_hooks/useLeagues";
import {NIGHT_TAKEN} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {
  effectiveTime,
  isIsoDate,
  isStartTime,
  NIGHT_STATUS_LABEL,
  nextNightIndex,
  nightLabelLong,
  nightsSummaryLabel,
  nightStatus,
  NightStatus,
  timeLabel,
} from "@/app/_lib/nights";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, cardSx, dateInputFix, EmptyState, ErrorNote, GhostIconButton, LoadingRows, tabular, TextInput, TimeInput} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// Upravljanje ligom · Datumi (design 11b "Datumi lige"): the league's nights, adding a night and removing one that has
// no rounds. Players see them in Raspored; Burza igrača offers only these nights to a team that needs a substitute.
// Each night starts at the league's time (Podaci) unless it has its own, which the admin sets here for a night still
// to be played and can take back to the league's.

const GRID = "56px minmax(0,1fr) 200px 140px 52px";
const PILL: Record<NightStatus, {bg: string; ink: string}> = {
  played: {bg: tint.green[12], ink: color.green},
  notPlayed: {bg: "transparent", ink: color.muted},
  next: {bg: color.navy, ink: color.white},
  upcoming: {bg: color.paper, ink: color.ink2},
};

// A league's nights being edited (Datumi on the desktop and on the admin's phone): adding a night, removing one that
// has no rounds, and a night's own start time. defaultTime: the league's start time (Podaci), "HH:MM" or null.
export function useLeagueDates(leagueId: number, defaultTime: string | null, data: ReturnType<typeof useLeagueNights>) {
  const {nights, setNights, error, reload} = data;
  const today = leagueDateString();
  const [draft, setDraft] = useState("");
  // the new night's own start time ("": the league's)
  const [draftTime, setDraftTime] = useState("");
  const [savingTime, setSavingTime] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // a night the server already had (another admin added it meanwhile), until the list is fetched again or the date
  // changes
  const [takenNight, setTakenNight] = useState<string | null>(null);

  const list = nights ?? [];
  // the league's last night tells whether its season is over (the status under Ukupni poredak opened from a team)
  const lastNight = nights ? nights.reduce<string | null>((last, n) => (last == null || n.date > last ? n.date : last), null) : undefined;
  useEffect(() => {
    if (lastNight !== undefined) updateCachedLeague(leagueId, {lastNight});
  }, [leagueId, lastNight]);
  const nextIndex = nextNightIndex(list.map((n) => n.date), today);
  const played = list.filter((n) => n.played).length;
  const toGo = list.filter((n) => n.date >= today).length;
  const duplicate = isIsoDate(draft) && (draft === takenNight || list.some((n) => n.date === draft));
  const canAdd = isIsoDate(draft) && !duplicate && !adding;

  const add = async () => {
    if (!canAdd) return;
    setAdding(true);
    setActionError(null);
    try {
      // the league's own time isn't kept as the night's, so the night follows a later change in Podaci
      const own = draftTime && draftTime !== defaultTime ? draftTime : null;
      await addLeagueNightAPI(leagueId, draft, own);
      setNights((prev) =>
        [...(prev ?? []), {date: draft, played: false, start_time: own, time: effectiveTime(own, defaultTime)}].sort((a, b) => a.date.localeCompare(b.date))
      );
      setDraft("");
      setDraftTime("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Večer nije dodana.";
      // the same line as the check here, and the list fetched again so the night shows
      if (message === NIGHT_TAKEN) {
        setTakenNight(draft);
        reload();
      } else setActionError(message);
    }
    setAdding(false);
  };

  // optimistic: the row goes at once and comes back if the server refuses
  const remove = async (date: string) => {
    setRemoving(date);
    setActionError(null);
    const before = nights;
    setNights((prev) => prev?.filter((n) => n.date !== date) ?? prev);
    try {
      await removeLeagueNightAPI(leagueId, date);
    } catch (err) {
      setNights(before);
      setActionError(err instanceof Error ? err.message : "Večer nije uklonjena.");
    }
    setRemoving(null);
  };

  // a night's own start time, or null for the league's; optimistic like remove
  const setTime = async (date: string, time: string | null) => {
    const own = time && time !== defaultTime ? time : null;
    setSavingTime(date);
    setActionError(null);
    const before = nights;
    setNights((prev) => prev?.map((n) => (n.date === date ? {...n, start_time: own, time: effectiveTime(own, defaultTime)} : n)) ?? prev);
    try {
      await setLeagueNightTimeAPI(leagueId, date, own);
    } catch (err) {
      setNights(before);
      setActionError(err instanceof Error ? err.message : "Početak večeri nije spremljen.");
    }
    setSavingTime(null);
  };

  // a new date: the night the server had (by now the fetched list has it) no longer marks it
  const changeDraft = (value: string) => {
    setDraft(value);
    setTakenNight(null);
  };
  return {nights, list, error, reload, today, nextIndex, played, toGo, draft, setDraft: changeDraft, draftTime, setDraftTime, savingTime, adding, removing, actionError, duplicate, canAdd, add, remove, setTime};
}

export default function DatesView({leagueId, defaultTime, data}: {leagueId: number; defaultTime: string | null; data: ReturnType<typeof useLeagueNights>}) {
  const {nights, list, error, reload, today, nextIndex, played, toGo, draft, setDraft, draftTime, setDraftTime, savingTime, adding, removing, actionError, duplicate, canAdd, add, remove, setTime} = useLeagueDates(leagueId, defaultTime, data);
  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: "20px"}}>
      <Card component="section" aria-labelledby="league-nights" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", p: "20px 20px 12px"}}>
          <Box component="h2" id="league-nights" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Večeri lige
          </Box>
          {list.length > 0 && (
            <Box component="span" sx={{fontSize: 14, color: color.muted}}>
              {nightsSummaryLabel(played, toGo)}
            </Box>
          )}
        </Box>
        <Box
          aria-hidden
          sx={{flex: "none", display: "grid", gridTemplateColumns: GRID, gap: "12px", alignItems: "center", height: 36, px: "20px", borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${tint.navy[12]}`, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
        >
          <span>#</span>
          <span>Datum</span>
          <span>Početak</span>
          <span>Status</span>
          <span />
        </Box>
        {error && !nights ? (
          <ErrorNote onRetry={reload} sx={{m: "14px"}}>
            {error}
          </ErrorNote>
        ) : !nights ? (
          <LoadingRows rows={8} height={56} />
        ) : list.length === 0 ? (
          <EmptyState>Liga još nema večeri. Dodaj prvu desno.</EmptyState>
        ) : (
          <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
            {list.map((n, i) => {
              const isNext = i === nextIndex;
              const status = nightStatus(n.date, isNext, today, n.played);
              return (
                <Box
                  component="li"
                  key={n.date}
                  aria-current={isNext ? "date" : undefined}
                  sx={{height: 56, display: "grid", gridTemplateColumns: GRID, gap: "12px", alignItems: "center", px: "20px", borderBottom: `1px solid ${color.divider}`, background: isNext ? color.cream2 : "transparent", boxShadow: isNext ? shadow.mineBar : "none"}}
                >
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.muted, ...tabular}}>
                    {i + 1}
                  </Box>
                  <Box component="span" sx={{fontSize: 16, fontWeight: isNext ? 700 : 600, color: color.ink}}>
                    {nightLabelLong(n.date)}
                  </Box>
                  <NightTime
                    night={n.date}
                    own={n.start_time}
                    defaultTime={defaultTime}
                    // a night with rounds or one that has passed keeps its time
                    editable={!n.played && n.date >= today}
                    busy={savingTime === n.date}
                    onSave={(time) => setTime(n.date, time)}
                  />
                  <Box component="span" sx={{justifySelf: "start", height: 26, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: PILL[status].bg, color: PILL[status].ink, fontSize: 12.5, fontWeight: 700}}>
                    {NIGHT_STATUS_LABEL[status]}
                  </Box>
                  {n.played ? (
                    <span />
                  ) : (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => remove(n.date)}
                      disabled={removing != null}
                      aria-label={`Ukloni večer ${nightLabelLong(n.date)}`}
                      title="Ukloni večer"
                      sx={{...buttonBase, width: 44, height: 44, borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[10], color: color.red}}}
                    >
                      <DeleteRoundedIcon />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Card>
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        <Box component="form" onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            add();
          }} noValidate aria-labelledby="add-night" sx={{...cardSx, flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "12px"}}>
          <Box component="h2" id="add-night" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Dodaj večer
          </Box>
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,150px)", gap: "8px"}}>
            <Box
              component="input"
              type="date"
              aria-label="Datum večeri"
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
              aria-invalid={duplicate || undefined}
              sx={{...dateInputFix, width: "100%", height: 52, boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${duplicate ? color.red : color.border}`, background: color.paper2, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy, background: color.white}}}
            />
            <TimeInput
              aria-label="Početak večeri"
              value={draftTime}
              onChange={setDraftTime}
              clearLabel="Ukloni početak večeri"
              soft
              sx={{borderRadius: "14px", fontSize: 16, px: "14px"}}
            />
          </Box>
          <Box sx={{fontSize: 13, lineHeight: 1.45, color: color.muted}}>
            {defaultTime ? `Početak je neobavezan. Bez njega večer počinje u ${defaultTime}, kao cijela liga.` : "Početak je neobavezan."}
          </Box>
          {duplicate && (
            <Box role="alert" sx={{fontSize: 13, fontWeight: 600, color: color.red}}>
              {NIGHT_TAKEN}
            </Box>
          )}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <Box
            component="button"
            type="submit"
            disabled={!canAdd}
            aria-busy={adding || undefined}
            sx={{...buttonBase, height: 52, borderRadius: "14px", background: color.navy, color: color.white, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 16, fontWeight: 600, "&:disabled": {opacity: 0.4}, "& svg": {fontSize: 22}}}
          >
            <AddRoundedIcon />
            Dodaj večer
          </Box>
        </Box>
        <Card component="section" aria-labelledby="nights-used" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box component="h2" id="nights-used" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
            Gdje se koristi
          </Box>
          <UsedLine icon={<SmartphoneRoundedIcon />}>
            Igrači vide večeri na mobitelu pod <b>Raspored</b>, sa sljedećom večeri istaknutom.
          </UsedLine>
          <UsedLine icon={<PersonSearchRoundedIcon />}>Burza igrača nudi samo ove večeri kad ekipa traži zamjenu.</UsedLine>
          <UsedLine icon={<ScheduleRoundedIcon />}>
            Raspored i Početna pokazuju i početak večeri. Zadani početak lige je na kartici <b>Podaci</b>, a ovdje ga mijenjaš pojedinoj večeri.
          </UsedLine>
          <UsedLine icon={<LockRoundedIcon />}>Odigrane večeri ne mogu se ukloniti ovdje. Prvo obriši njihova kola na kartici Kola.</UsedLine>
        </Card>
      </Box>
    </Box>
  );
}

// A night's start time: its own (bold), the league's (muted, "zadano") or "—". A night still to be played gets a
// pencil that opens a time field (Enter or ✓ saves, Escape or leaving the field cancels) and, with its own time, a
// button back to the league's.
function NightTime({
  night,
  own,
  defaultTime,
  editable,
  busy,
  onSave,
}: {
  night: string;
  own: string | null;
  defaultTime: string | null;
  editable: boolean;
  busy: boolean;
  onSave: (time: string | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const time = effectiveTime(own, defaultTime);
  const label = nightLabelLong(night);

  if (editing != null) {
    const save = () => {
      setEditing(null);
      if (editing === "" ? own != null : isStartTime(editing) && editing !== time) onSave(editing || null);
    };
    return (
      <Box
        component="form"
        noValidate
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          save();
        }}
        onBlur={(e: React.FocusEvent<HTMLFormElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(null);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") setEditing(null);
        }}
        sx={{display: "flex", alignItems: "center", gap: "4px", minWidth: 0}}
      >
        <TextInput
          type="time"
          autoFocus
          aria-label={`Početak večeri ${label}`}
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          sx={{...dateInputFix, flex: 1, height: 40, borderRadius: "10px", fontSize: 15, px: "10px"}}
        />
        <GhostIconButton type="submit" label="Spremi početak" size={36} sx={{color: color.navy}}>
          <CheckRoundedIcon />
        </GhostIconButton>
      </Box>
    );
  }

  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "2px", minWidth: 0}}>
      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "6px", fontSize: 15, ...tabular}}>
        <Box component="span" sx={{fontWeight: own ? 700 : 500, color: own ? color.ink : color.muted}}>
          {timeLabel(time)}
        </Box>
        {!own && time && (
          <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
            zadano
          </Box>
        )}
      </Box>
      {editable && (
        <>
          {own && (
            <GhostIconButton label={defaultTime ? `Vrati zadani početak (${defaultTime})` : "Ukloni početak"} size={36} onClick={() => onSave(null)} disabled={busy}>
              <RestartAltRoundedIcon />
            </GhostIconButton>
          )}
          <GhostIconButton label={`Promijeni početak večeri ${label}`} size={36} onClick={() => setEditing(time ?? "")} disabled={busy}>
            <EditRoundedIcon />
          </GhostIconButton>
        </>
      )}
    </Box>
  );
}

function UsedLine({icon, children}: {icon: React.ReactNode; children: React.ReactNode}) {
  return (
    <Box sx={{display: "flex", gap: "10px", alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: color.ink, "& > svg": {fontSize: 22, flex: "none", color: color.ink}}}>
      {icon}
      <span>{children}</span>
    </Box>
  );
}
