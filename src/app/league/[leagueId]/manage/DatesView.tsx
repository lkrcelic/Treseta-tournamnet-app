"use client";

import {addLeagueNightAPI, removeLeagueNightAPI} from "@/app/_fetchers/league/nights";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import {leagueDateString} from "@/app/_lib/dates";
import {isIsoDate, nextNightIndex, nightLabelLong, nightStatus, NightStatus} from "@/app/_lib/nights";
import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, Card, cardSx, dateInputFix, EmptyState, ErrorNote, LoadingRows, tabular} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";

// Manage League · Dates (Claude Design "Manage League · Dates"): the league's nights, adding a night and removing one
// that has no rounds. Players see them in Raspored; Burza igrača offers only these nights to a team that needs a
// substitute.

const GRID = "56px minmax(0,1fr) 140px 52px";
const STATUS: Record<NightStatus, {label: string; bg: string; ink: string}> = {
  played: {label: "Played", bg: "rgba(56,102,65,.12)", ink: color.green},
  notPlayed: {label: "Not played", bg: "transparent", ink: color.faint},
  next: {label: "Next", bg: color.navy, ink: "#FFFFFF"},
  upcoming: {label: "Upcoming", bg: color.paper, ink: color.inkSoft},
};

export default function DatesView({leagueId, data}: {leagueId: number; data: ReturnType<typeof useLeagueNights>}) {
  const {nights, setNights, error, reload} = data;
  const today = leagueDateString();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = nights ?? [];
  const nextIndex = nextNightIndex(list.map((n) => n.date), today);
  const played = list.filter((n) => n.played).length;
  const toGo = list.filter((n) => n.date >= today).length;
  const duplicate = isIsoDate(draft) && list.some((n) => n.date === draft);
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
      setActionError(err instanceof Error ? err.message : "The night wasn't added.");
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
      setActionError(err instanceof Error ? err.message : "The night wasn't removed.");
    }
    setRemoving(null);
  };

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: "20px"}}>
      <Card component="section" aria-labelledby="league-nights" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", p: "20px 20px 12px"}}>
          <Box component="h2" id="league-nights" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            League nights
          </Box>
          {nights && (
            <Box component="span" sx={{fontSize: 14, color: color.muted}}>
              {played} played · {toGo} to go
            </Box>
          )}
        </Box>
        <Box
          aria-hidden
          sx={{flex: "none", display: "grid", gridTemplateColumns: GRID, gap: "12px", alignItems: "center", height: 36, px: "20px", borderTop: `1px solid ${color.line}`, borderBottom: "1px solid rgba(60,74,103,.12)", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
        >
          <span>#</span>
          <span>Date</span>
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
          <EmptyState>No nights yet. Add the first one on the right.</EmptyState>
        ) : (
          <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable"}}>
            {list.map((n, i) => {
              const isNext = i === nextIndex;
              const status = STATUS[nightStatus(n.date, isNext, today, n.played)];
              return (
                <Box
                  component="li"
                  key={n.date}
                  aria-current={isNext ? "date" : undefined}
                  sx={{height: 56, display: "grid", gridTemplateColumns: GRID, gap: "12px", alignItems: "center", px: "20px", borderBottom: "1px solid rgba(60,74,103,.07)", background: isNext ? color.mine : "transparent", boxShadow: isNext ? shadow.mineBar : "none"}}
                >
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.muted, ...tabular}}>
                    {i + 1}
                  </Box>
                  <Box component="span" sx={{fontSize: 16, fontWeight: isNext ? 700 : 600, color: color.ink}}>
                    {nightLabelLong(n.date)}
                  </Box>
                  <Box component="span" sx={{justifySelf: "start", height: 26, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: status.bg, color: status.ink, fontSize: 12.5, fontWeight: 700}}>
                    {status.label}
                  </Box>
                  {n.played ? (
                    <span />
                  ) : (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => remove(n.date)}
                      disabled={removing != null}
                      aria-label={`Remove the night ${nightLabelLong(n.date)}`}
                      title="Remove night"
                      sx={{...buttonBase, width: 44, height: 44, borderRadius: "12px", color: color.placeholder, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: "rgba(188,71,73,.1)", color: color.red}}}
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
            Add a night
          </Box>
          <Box
            component="input"
            type="date"
            aria-label="Date of the night"
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            aria-invalid={duplicate || undefined}
            sx={{...dateInputFix, width: "100%", height: 52, boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${duplicate ? color.red : "rgba(60,74,103,.18)"}`, background: color.tableHead, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy, background: color.card}}}
          />
          {duplicate && (
            <Box role="alert" sx={{fontSize: 13, fontWeight: 600, color: color.red}}>
              This night is already on the list.
            </Box>
          )}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <Box
            component="button"
            type="submit"
            disabled={!canAdd}
            aria-busy={adding || undefined}
            sx={{...buttonBase, height: 52, borderRadius: "14px", background: color.navy, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 16, fontWeight: 600, "&:disabled": {opacity: 0.4}, "& svg": {fontSize: 22}}}
          >
            <AddRoundedIcon />
            Add night
          </Box>
        </Box>
        <Card component="section" aria-labelledby="nights-used" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box component="h2" id="nights-used" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
            Where this is used
          </Box>
          <UsedLine icon={<SmartphoneRoundedIcon />}>
            Players see the nights on their phone under <b>Raspored</b>, with the next night highlighted.
          </UsedLine>
          <UsedLine icon={<PersonSearchRoundedIcon />}>Burza igrača offers only these nights when a team asks for a substitute.</UsedLine>
          <UsedLine icon={<LockRoundedIcon />}>Played nights can&apos;t be removed here. Delete their rounds in the Rounds tab first.</UsedLine>
        </Card>
      </Box>
    </Box>
  );
}

function UsedLine({icon, children}: {icon: React.ReactNode; children: React.ReactNode}) {
  return (
    <Box sx={{display: "flex", gap: "10px", alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: color.ink2, "& > svg": {fontSize: 22, flex: "none", color: color.ink}}}>
      {icon}
      <span>{children}</span>
    </Box>
  );
}
