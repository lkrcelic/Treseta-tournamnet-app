"use client";

import {addLeagueNightAPI, removeLeagueNightAPI, updateLeagueNightAPI} from "@/app/_fetchers/league/nights";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import {updateCachedLeague} from "@/app/_hooks/useLeagues";
import {LeagueNightAdd, LeagueNightRow, LeagueNightUpdate, NIGHT_TAKEN} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {
  effectiveTime,
  gatheringLabel,
  NIGHT_STATUS_LABEL,
  NightLocation,
  nextNightIndex,
  nightLabelLong,
  nightsSummaryLabel,
  nightStatus,
  NightStatus,
  playedNightRemovalText,
  suggestedNightDate,
} from "@/app/_lib/nights";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {NightGatheringForm, NightGatheringHeading, NightInfo} from "@/app/_ui/admin/GatheringForm";
import {GatheringLine} from "@/app/_ui/gathering/Gathering";
import {buttonBase, Card, EmptyState, ErrorNote, LoadingRows, OutlineButton, PrimaryButton, SolidButton, tabular} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useEffect, useId, useRef, useState} from "react";

// Upravljanje ligom · Datumi (design 11b "Datumi i okupljanje lige"): the league's nights, adding one and removing one.
// Players see them in Raspored; Burza igrača offers only these nights to a team that needs a substitute. Each night
// gathers at the league's time and place (Podaci) unless it has its own. Dodaj večer (a button over the list) opens the
// whole form, starting on the league's play day with its time and place. A click on a night opens it: one still to be
// played in Uredi večer, where it moves to another date and gets its own time and place or the league's back; one that
// has passed or has rounds shows when and where it was and can only be removed, a played one with its rounds and
// results after Obrisati odigranu večer?.

const GRID = "56px minmax(0,1fr) 140px 52px";
const PILL: Record<NightStatus, {bg: string; ink: string}> = {
  played: {bg: tint.green[12], ink: color.green},
  notPlayed: {bg: "transparent", ink: color.muted},
  next: {bg: color.navy, ink: color.white},
  upcoming: {bg: color.paper, ink: color.ink2},
};

// The league's default time and place (Podaci), which a night without its own follows, and its play day (0 = Monday),
// which Dodaj večer's date starts on
export type GatheringDefaults = {time: string | null; location: NightLocation | null; playDay?: number | null};

// The league's defaults from the cached league list (Upravljanje ligom on the desktop and the phone)
export const gatheringDefaults = (l: {startTime?: string | null; location?: NightLocation | null; playDay?: number | null} | undefined): GatheringDefaults => ({
  time: l?.startTime ?? null,
  location: l?.location ?? null,
  playDay: l?.playDay ?? null,
});

// A night's time and place as Datumi shows them: worked out here from the league's current defaults, so a change in
// Podaci shows at once
export type DatesNight = LeagueNightRow;

// Whether a night's time and place can still change: one with rounds or one that has passed keeps them
export const nightEditable = (n: {played: boolean; date: string}, today: string) => !n.played && n.date >= today;

const byDate = (a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date);

// A league's nights being edited (Datumi on the desktop and on the admin's phone): adding a night (Dodaj večer),
// removing one (a played one with its rounds: onRoundsGone tells the page), and a night's date and own time and place.
export function useLeagueDates(leagueId: number, defaults: GatheringDefaults, data: ReturnType<typeof useLeagueNights>, onRoundsGone?: () => void) {
  const {nights, setNights, error, reload} = data;
  const today = leagueDateString();
  // the night whose time and place are being saved
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // why a night wasn't added, or its date, time and place weren't saved (shown in its form)
  const [saveError, setSaveError] = useState<string | null>(null);
  // the date a night was just moved to: its form opens as saved
  const [movedTo, setMovedTo] = useState<string | null>(null);
  // why a played night wasn't removed (shown in Obrisati odigranu večer?)
  const [removeError, setRemoveError] = useState<string | null>(null);
  // a night the server already had (another admin added it meanwhile), until the list is fetched again
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
  // Dodaj večer starts on the league's play day after its last night
  const suggestedDate = suggestedNightDate(list.map((n) => n.date), today, defaults.playDay);

  // a new night with its own time and place, or the league's (the form keeps the league's time as none of its own, so
  // the night follows a later change in Podaci); resolves to whether it was added
  const add = async (night: LeagueNightAdd): Promise<boolean> => {
    setAdding(true);
    setSaveError(null);
    try {
      await addLeagueNightAPI(leagueId, night);
      const start_time = night.start_time ?? null;
      const location = night.location ? {name: night.location.name, address: night.location.address ?? null, url: night.location.url ?? null} : null;
      setNights((prev) =>
        [...(prev ?? []), {date: night.date, played: false, rounds: 0, start_time, time: effectiveTime(start_time, defaultTime), location, place: location ?? defaults.location}].sort(byDate)
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Večer nije dodana.";
      // another admin added it meanwhile: the list is fetched again so it shows, and the form marks the date as taken
      if (message === NIGHT_TAKEN) {
        setTakenNight(night.date);
        reload();
      }
      setSaveError(message);
      return false;
    } finally {
      setAdding(false);
    }
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

  // a played night with its rounds and their results (Obrisati odigranu večer?); resolves to whether it went
  const removePlayed = async (date: string): Promise<boolean> => {
    setRemoving(date);
    setRemoveError(null);
    try {
      await removeLeagueNightAPI(leagueId, date, true);
      setNights((prev) => prev?.filter((n) => n.date !== date) ?? prev);
      onRoundsGone?.();
      return true;
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Večer nije uklonjena.");
      return false;
    } finally {
      setRemoving(null);
    }
  };

  // a night's new date, own time and place (null: the league's); resolves to the night's date once saved (the new one
  // when it moved), or null
  const update = async (date: string, change: LeagueNightUpdate): Promise<string | null> => {
    setSaving(date);
    setSaveError(null);
    try {
      const night = await updateLeagueNightAPI(leagueId, date, change);
      setNights((prev) => prev?.map((n) => (n.date === date ? {...n, date: night.date, start_time: night.start_time, location: night.location} : n)).sort(byDate) ?? prev);
      setMovedTo(night.date === date ? null : night.date);
      return night.date;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Večer nije spremljena.");
      return null;
    } finally {
      setSaving(null);
    }
  };
  // whether the league already has a night on that date (the form's Datum večeri)
  const taken = (date: string) => date === takenNight || list.some((n) => n.date === date);

  const clearError = () => {
    setActionError(null);
    setSaveError(null);
    setRemoveError(null);
    setMovedTo(null);
  };
  return {
    nights,
    list,
    error,
    reload,
    today,
    nextIndex,
    played,
    toGo,
    suggestedDate,
    saving,
    adding,
    removing,
    actionError,
    saveError,
    removeError,
    movedTo,
    clearError,
    add,
    remove,
    removePlayed,
    update,
    taken,
  };
}

// "Zadano okupljanje: 19:30 · Caffe bar Kartaš" (null: the league has neither)
export function defaultGatheringLabel(defaults: GatheringDefaults): string | null {
  return gatheringLabel(defaults.time, defaults.location);
}

export default function DatesView({
  leagueId,
  defaults,
  data,
  onRoundsGone,
}: {
  leagueId: number;
  defaults: GatheringDefaults;
  data: ReturnType<typeof useLeagueNights>;
  // a played night went with its rounds (the page's Kola list is out of date)
  onRoundsGone?: () => void;
}) {
  const ld = useLeagueDates(leagueId, defaults, data, onRoundsGone);
  const {nights, list, error, reload, today, nextIndex, played, toGo, saving, adding, removing, actionError, saveError, clearError, remove, update} = ld;
  // the card on the right: Dodaj večer's form (creating), else the night clicked, else the next one still to be played
  // (tonight's night with rounds is past changing, so the one after it)
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // the played night asked about in Obrisati odigranu večer?
  const [asking, setAsking] = useState<DatesNight | null>(null);
  const selected = creating ? null : (list.find((n) => n.date === picked) ?? list.find((n) => nightEditable(n, today)) ?? null);
  const pick = (date: string) => {
    if (!creating && date === selected?.date) return;
    setCreating(false);
    setPicked(date);
    clearError();
  };
  const startCreating = () => {
    setCreating(true);
    clearError();
  };
  const askRemove = (n: DatesNight) => {
    clearError();
    setAsking(n);
  };
  const defaultTime = defaults.time;
  const selectedEditable = selected != null && nightEditable(selected, today);
  // another night (or Nova večer) on the right starts at its top, not where the last one was scrolled to
  const panel = useRef<HTMLDivElement>(null);
  const shown = creating ? "new" : selected?.date;
  useEffect(() => {
    panel.current?.scrollTo({top: 0});
  }, [shown]);

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: "20px"}}>
      <Card component="section" aria-labelledby="league-nights" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "16px 16px 12px 20px"}}>
          <Box component="h2" id="league-nights" sx={{m: 0, flex: 1, minWidth: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Večeri lige
          </Box>
          {list.length > 0 && (
            <Box component="span" sx={{fontSize: 14, color: color.muted}}>
              {nightsSummaryLabel(played, toGo)}
            </Box>
          )}
          <SolidButton height={44} onClick={startCreating} aria-pressed={creating} sx={{flex: "none", px: "16px", borderRadius: "14px", fontSize: 15, "& svg": {fontSize: 22}}}>
            <AddRoundedIcon aria-hidden />
            Dodaj večer
          </SolidButton>
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
        {actionError && <ErrorNote sx={{m: "12px 14px 0"}}>{actionError}</ErrorNote>}
        {error && !nights ? (
          <ErrorNote onRetry={reload} sx={{m: "14px"}}>
            {error}
          </ErrorNote>
        ) : !nights ? (
          <LoadingRows rows={8} height={60} />
        ) : list.length === 0 ? (
          <EmptyState>Liga još nema večeri. Dodaj prvu gumbom Dodaj večer.</EmptyState>
        ) : (
          <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
            {list.map((n, i) => {
              const isNext = i === nextIndex;
              const status = nightStatus(n.date, isNext, today, n.played);
              const isSelected = selected?.date === n.date;
              return (
                <Box
                  component="li"
                  key={n.date}
                  aria-current={isNext ? "date" : undefined}
                  onClick={() => pick(n.date)}
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
                    cursor: "pointer",
                    "&:hover": !isSelected ? {background: isNext ? color.cream2 : color.paper2} : undefined,
                  }}
                >
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.muted, ...tabular}}>
                    {i + 1}
                  </Box>
                  <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start"}}>
                    {/* the row's click, for the keyboard and a screen reader: the date is a button */}
                    <Box
                      component="button"
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${nightEditable(n, today) ? "Uredi večer" : "Večer"} ${nightLabelLong(n.date)}`}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        pick(n.date);
                      }}
                      sx={{...buttonBase, textAlign: "left", fontSize: 16, fontWeight: isNext || isSelected ? 700 : 600, color: color.ink, borderRadius: "6px"}}
                    >
                      {nightLabelLong(n.date)}
                    </Box>
                    <GatheringLine time={n.time} place={n.place} ownTime={n.start_time != null} ownPlace={n.location != null} />
                  </Box>
                  <Box component="span" sx={{justifySelf: "start", height: 26, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: PILL[status].bg, color: PILL[status].ink, fontSize: 12.5, fontWeight: 700}}>
                    {NIGHT_STATUS_LABEL[status]}
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={(e: React.MouseEvent) => {
                      // removing a night doesn't open it; a played one asks first
                      e.stopPropagation();
                      if (n.played) askRemove(n);
                      else remove(n.date);
                    }}
                    disabled={removing != null}
                    aria-haspopup={n.played ? "dialog" : undefined}
                    aria-label={`${n.played ? "Obriši odigranu večer" : "Ukloni večer"} ${nightLabelLong(n.date)}`}
                    title={n.played ? "Obriši odigranu večer" : "Ukloni večer"}
                    sx={{...buttonBase, width: 44, height: 44, borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[10], color: color.red}}}
                  >
                    <DeleteRoundedIcon />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Card>
      <Box ref={panel} sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        {creating ? (
          <Card component="section" aria-label="Dodaj večer" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
            <NightGatheringHeading eyebrow="Dodaj večer" title="Nova večer" />
            <NightGatheringForm
              key="new"
              isNew
              night={{date: ld.suggestedDate, start_time: null, location: null}}
              onCancel={() => setCreating(false)}
              today={today}
              taken={ld.taken}
              leagueTime={defaultTime}
              leaguePlace={defaults.location}
              settingsTab="Podaci"
              onSave={async (night) => {
                const added = await ld.add({date: night.date!, start_time: night.start_time, location: night.location});
                // the new night opens in Uredi večer
                if (added) pick(night.date!);
                return added;
              }}
              saving={adding}
              error={saveError}
              inputSx={{height: 48, borderRadius: "14px", fontSize: 15}}
            />
          </Card>
        ) : selected && selectedEditable ? (
          <Card component="section" aria-label="Uredi večer" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
            <NightGatheringHeading date={selected.date} />
            <NightGatheringForm
              key={selected.date}
              night={selected}
              today={today}
              taken={ld.taken}
              leagueTime={defaultTime}
              leaguePlace={defaults.location}
              settingsTab="Podaci"
              onSave={async (change) => {
                const date = await update(selected.date, change);
                // a moved night stays open under its new date
                if (date) setPicked(date);
                return date != null;
              }}
              saving={saving === selected.date}
              error={saveError}
              savedAtStart={ld.movedTo === selected.date}
              inputSx={{height: 48, borderRadius: "14px", fontSize: 15}}
            />
          </Card>
        ) : selected ? (
          <Card component="section" aria-label={`Večer ${nightLabelLong(selected.date)}`} sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
            <NightGatheringHeading date={selected.date} eyebrow={selected.played ? "Odigrana večer" : "Prošla večer"} />
            <NightInfo night={selected}>
              <OutlineButton
                height={52}
                tone={color.red}
                disabled={removing != null}
                aria-haspopup={selected.played ? "dialog" : undefined}
                onClick={() => (selected.played ? askRemove(selected) : remove(selected.date))}
                sx={{fontSize: 16, borderWidth: "1.5px", borderColor: tint.red[35]}}
              >
                <DeleteRoundedIcon aria-hidden sx={{fontSize: 20}} />
                {selected.played ? "Obriši večer i kola" : "Makni večer"}
              </OutlineButton>
            </NightInfo>
          </Card>
        ) : null}
        <Card component="section" aria-labelledby="nights-used" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box component="h2" id="nights-used" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
            Gdje se koristi
          </Box>
          <UsedLine icon={<SmartphoneRoundedIcon />}>
            Igrači vide večeri na mobitelu pod <b>Raspored</b>, sa sljedećom večeri istaknutom.
          </UsedLine>
          <UsedLine icon={<PersonSearchRoundedIcon />}>Burza igrača nudi samo ove večeri kad ekipa traži zamjenu.</UsedLine>
          <UsedLine icon={<PlaceRoundedIcon />}>
            Nova večer počinje s vremenom i mjestom lige s kartice <b>Podaci</b>; pojedinoj večeri ih mijenjaš ovdje.
          </UsedLine>
          <UsedLine icon={<WarningRoundedIcon />}>Odigrana večer briše se zajedno sa svojim kolima i svim upisanim rezultatima.</UsedLine>
        </Card>
      </Box>
      {asking && (
        <RemovePlayedNightDialog
          night={asking}
          busy={removing === asking.date}
          error={ld.removeError}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            if (await ld.removePlayed(asking.date)) setAsking(null);
          }}
        />
      )}
    </Box>
  );
}

// Obrisati odigranu večer? on the computer: the night's rounds and results go with it, Odustani and the red action
function RemovePlayedNightDialog({night, busy, error, onClose, onConfirm}: {night: DatesNight; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 520, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.15}}>
        Obrisati odigranu večer?
      </Box>
      <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 26, color: color.red, flex: "none"}}}>
        <WarningRoundedIcon aria-hidden />
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, textWrap: "pretty"}}>
          {playedNightRemovalText(night.date, night.rounds)}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "10px"}}>
        <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${tint.navy[25]}`}}>
          Odustani
        </OutlineButton>
        <PrimaryButton height={52} bg={color.red} onClick={onConfirm} loading={busy} sx={{flex: 1, fontSize: 16, borderRadius: "16px", boxShadow: "none"}}>
          Obriši večer i kola
        </PrimaryButton>
      </Box>
    </Dialog>
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
