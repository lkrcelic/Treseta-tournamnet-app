"use client";

import {addLeagueNightAPI, removeLeagueNightAPI} from "@/app/_fetchers/league/nights";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import {updateCachedLeague} from "@/app/_hooks/useLeagues";
import {NIGHT_TAKEN} from "@/app/_interfaces/league";
import {leagueDateString} from "@/app/_lib/dates";
import {isIsoDate, NIGHT_STATUS_LABEL, nextNightIndex, nightLabelLong, nightsSummaryLabel, nightStatus, NightStatus} from "@/app/_lib/nights";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, cardSx, dateInputFix, EmptyState, ErrorNote, LoadingRows, tabular} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// Upravljanje ligom · Datumi (design 11b "Datumi lige"): the league's nights, adding a night and removing one that has
// no rounds. Players see them in Raspored; Burza igrača offers only these nights to a team that needs a substitute.

const GRID = "56px minmax(0,1fr) 140px 52px";
const PILL: Record<NightStatus, {bg: string; ink: string}> = {
  played: {bg: tint.green[12], ink: color.green},
  notPlayed: {bg: "transparent", ink: color.muted},
  next: {bg: color.navy, ink: color.white},
  upcoming: {bg: color.paper, ink: color.ink2},
};

export default function DatesView({leagueId, data}: {leagueId: number; data: ReturnType<typeof useLeagueNights>}) {
  const {nights, setNights, error, reload} = data;
  const today = leagueDateString();
  const [draft, setDraft] = useState("");
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

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    setAdding(true);
    setActionError(null);
    try {
      await addLeagueNightAPI(leagueId, draft);
      setNights((prev) => [...(prev ?? []), {date: draft, played: false}].sort((a, b) => a.date.localeCompare(b.date)));
      setDraft("");
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
        <Box component="form" onSubmit={add} noValidate aria-labelledby="add-night" sx={{...cardSx, flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "12px"}}>
          <Box component="h2" id="add-night" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Dodaj večer
          </Box>
          <Box
            component="input"
            type="date"
            aria-label="Datum večeri"
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setDraft(e.target.value);
              // by now the fetched list has that night
              setTakenNight(null);
            }}
            aria-invalid={duplicate || undefined}
            sx={{...dateInputFix, width: "100%", height: 52, boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${duplicate ? color.red : color.border}`, background: color.paper2, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy, background: color.white}}}
          />
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
