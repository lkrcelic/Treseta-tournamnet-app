"use client";

import {addLeagueNightAPI, removeLeagueNightAPI, updateLeagueNightAPI} from "@/app/_fetchers/league/nights";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import {updateCachedLeague} from "@/app/_hooks/useLeagues";
import {LeagueNightRow, LeagueNightUpdate, NIGHT_TAKEN} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {
  effectiveTime,
  gatheringLabel,
  isIsoDate,
  NIGHT_STATUS_LABEL,
  NightLocation,
  nextNightIndex,
  nightLabelLong,
  nightsSummaryLabel,
  nightStatus,
  NightStatus,
} from "@/app/_lib/nights";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {NightGatheringForm, NightGatheringHeading} from "@/app/_ui/admin/GatheringForm";
import {GatheringLine} from "@/app/_ui/gathering/Gathering";
import {buttonBase, Card, cardSx, dateInputFix, EmptyState, ErrorNote, LoadingRows, tabular, TimeInput} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// Upravljanje ligom · Datumi (design 11b "Datumi i okupljanje lige"): the league's nights, adding a night and removing
// one that has no rounds. Players see them in Raspored; Burza igrača offers only these nights to a team that needs a
// substitute. Each night gathers at the league's time and place (Podaci) unless it has its own, which the admin sets
// in Okupljanje večeri for a night still to be played (a click on its row) and can take back to the league's.

const GRID = "56px minmax(0,1fr) 140px 52px";
const PILL: Record<NightStatus, {bg: string; ink: string}> = {
  played: {bg: tint.green[12], ink: color.green},
  notPlayed: {bg: "transparent", ink: color.muted},
  next: {bg: color.navy, ink: color.white},
  upcoming: {bg: color.paper, ink: color.ink2},
};

// The league's default time and place (Podaci), which a night without its own follows
export type GatheringDefaults = {time: string | null; location: NightLocation | null};

// The league's defaults from the cached league list (Upravljanje ligom on the desktop and the phone)
export const gatheringDefaults = (l: {startTime?: string | null; location?: NightLocation | null} | undefined): GatheringDefaults => ({
  time: l?.startTime ?? null,
  location: l?.location ?? null,
});

// A night's time and place as Datumi shows them: worked out here from the league's current defaults, so a change in
// Podaci shows at once
export type DatesNight = LeagueNightRow;

// Whether a night's time and place can still change: one with rounds or one that has passed keeps them
export const nightEditable = (n: {played: boolean; date: string}, today: string) => !n.played && n.date >= today;

// A league's nights being edited (Datumi on the desktop and on the admin's phone): adding a night, removing one that
// has no rounds, and a night's own time and place.
export function useLeagueDates(leagueId: number, defaults: GatheringDefaults, data: ReturnType<typeof useLeagueNights>) {
  const {nights, setNights, error, reload} = data;
  const today = leagueDateString();
  const [draft, setDraft] = useState("");
  // the new night's own start time ("": the league's)
  const [draftTime, setDraftTime] = useState("");
  // the night whose time and place are being saved
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // a night the server already had (another admin added it meanwhile), until the list is fetched again or the date
  // changes
  const [takenNight, setTakenNight] = useState<string | null>(null);

  const defaultTime = defaults.time;
  const list: DatesNight[] = (nights ?? []).map((n) => ({...n, time: effectiveTime(n.start_time, defaultTime), place: n.location ?? defaults.location}));
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
      // a new night gathers at the league's place; Okupljanje večeri gives it another
      setNights((prev) =>
        [...(prev ?? []), {date: draft, played: false, start_time: own, time: effectiveTime(own, defaultTime), location: null, place: defaults.location}].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
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

  // a night's own time and place (null: the league's); resolves to whether they were saved
  const update = async (date: string, change: LeagueNightUpdate): Promise<boolean> => {
    setSaving(date);
    setActionError(null);
    try {
      const night = await updateLeagueNightAPI(leagueId, date, change);
      setNights((prev) => prev?.map((n) => (n.date === date ? {...n, start_time: night.start_time, location: night.location} : n)) ?? prev);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Okupljanje večeri nije spremljeno.");
      return false;
    } finally {
      setSaving(null);
    }
  };

  // a new date: the night the server had (by now the fetched list has it) no longer marks it
  const changeDraft = (value: string) => {
    setDraft(value);
    setTakenNight(null);
  };
  const clearError = () => setActionError(null);
  return {
    nights,
    list,
    error,
    reload,
    today,
    nextIndex,
    played,
    toGo,
    draft,
    setDraft: changeDraft,
    draftTime,
    setDraftTime,
    saving,
    adding,
    removing,
    actionError,
    clearError,
    duplicate,
    canAdd,
    add,
    remove,
    update,
  };
}

// "Zadano okupljanje: 19:30 · Caffe bar Kartaš" (null: the league has neither)
export function defaultGatheringLabel(defaults: GatheringDefaults): string | null {
  return gatheringLabel(defaults.time, defaults.location);
}

export default function DatesView({leagueId, defaults, data}: {leagueId: number; defaults: GatheringDefaults; data: ReturnType<typeof useLeagueNights>}) {
  const {nights, list, error, reload, today, nextIndex, played, toGo, draft, setDraft, draftTime, setDraftTime, saving, adding, removing, actionError, clearError, duplicate, canAdd, add, remove, update} =
    useLeagueDates(leagueId, defaults, data);
  // the night whose time and place are shown in Okupljanje večeri: the one clicked, else the next one
  const [picked, setPicked] = useState<string | null>(null);
  const next = nextIndex >= 0 ? list[nextIndex] : null;
  const selected = list.find((n) => n.date === picked && nightEditable(n, today)) ?? (next && nightEditable(next, today) ? next : null);
  const pick = (date: string) => {
    if (date === selected?.date) return;
    setPicked(date);
    clearError();
  };
  const defaultTime = defaults.time;

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
          <span>Datum · mjesto</span>
          <span>Status</span>
          <span />
        </Box>
        {error && !nights ? (
          <ErrorNote onRetry={reload} sx={{m: "14px"}}>
            {error}
          </ErrorNote>
        ) : !nights ? (
          <LoadingRows rows={8} height={60} />
        ) : list.length === 0 ? (
          <EmptyState>Liga još nema večeri. Dodaj prvu desno.</EmptyState>
        ) : (
          <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
            {list.map((n, i) => {
              const isNext = i === nextIndex;
              const status = nightStatus(n.date, isNext, today, n.played);
              // a night still to be played opens in Okupljanje večeri; one with rounds or one that has passed keeps its
              // time and place
              const editable = nightEditable(n, today);
              const isSelected = selected?.date === n.date;
              return (
                <Box
                  component="li"
                  key={n.date}
                  aria-current={isNext ? "date" : undefined}
                  onClick={editable ? () => pick(n.date) : undefined}
                  sx={{
                    minHeight: 60,
                    py: "8px",
                    boxSizing: "border-box",
                    display: "grid",
                    gridTemplateColumns: GRID,
                    gap: "12px",
                    alignItems: "center",
                    px: "20px",
                    borderBottom: `1px solid ${color.divider}`,
                    background: isSelected ? color.lineFill : isNext ? color.cream2 : "transparent",
                    boxShadow: isSelected ? shadow.mineBar : "none",
                    cursor: editable ? "pointer" : "default",
                    "&:hover": editable && !isSelected ? {background: isNext ? color.cream2 : color.paper2} : undefined,
                  }}
                >
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.muted, ...tabular}}>
                    {i + 1}
                  </Box>
                  <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start"}}>
                    {editable ? (
                      // the row's click, for the keyboard and a screen reader: the date is a button
                      <Box
                        component="button"
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Okupljanje večeri ${nightLabelLong(n.date)}`}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          pick(n.date);
                        }}
                        sx={{...buttonBase, textAlign: "left", fontSize: 16, fontWeight: isNext || isSelected ? 700 : 600, color: color.ink, borderRadius: "6px"}}
                      >
                        {nightLabelLong(n.date)}
                      </Box>
                    ) : (
                      <Box component="span" sx={{fontSize: 16, fontWeight: isNext ? 700 : 600, color: color.ink}}>
                        {nightLabelLong(n.date)}
                      </Box>
                    )}
                    <GatheringLine time={n.time} place={n.place} ownTime={n.start_time != null} ownPlace={n.location != null} />
                  </Box>
                  <Box component="span" sx={{justifySelf: "start", height: 26, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: PILL[status].bg, color: PILL[status].ink, fontSize: 12.5, fontWeight: 700}}>
                    {NIGHT_STATUS_LABEL[status]}
                  </Box>
                  {n.played ? (
                    <span />
                  ) : (
                    <Box
                      component="button"
                      type="button"
                      onClick={(e: React.MouseEvent) => {
                        // removing a night doesn't open it in Okupljanje večeri
                        e.stopPropagation();
                        remove(n.date);
                      }}
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
        {selected && (
          <Card component="section" aria-label="Okupljanje večeri" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
            <NightGatheringHeading date={selected.date} />
            <NightGatheringForm
              key={selected.date}
              night={selected}
              leagueTime={defaultTime}
              leaguePlace={defaults.location}
              settingsTab="Podaci"
              onSave={(change) => update(selected.date, change)}
              saving={saving === selected.date}
              error={actionError}
              inputSx={{height: 48, borderRadius: "14px", fontSize: 15}}
            />
          </Card>
        )}
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
          {actionError && !selected && <ErrorNote>{actionError}</ErrorNote>}
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
          <UsedLine icon={<PlaceRoundedIcon />}>
            Raspored i Početna pokazuju vrijeme i mjesto okupljanja. Zadano je na kartici <b>Podaci</b>, a ovdje ga mijenjaš pojedinoj večeri.
          </UsedLine>
          <UsedLine icon={<LockRoundedIcon />}>Odigrane večeri ne mogu se ukloniti ovdje. Prvo obriši njihova kola na kartici Kola.</UsedLine>
        </Card>
      </Box>
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
