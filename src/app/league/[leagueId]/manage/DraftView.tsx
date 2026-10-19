"use client";

import useConferences from "@/app/_hooks/useConferences";
import useLeagueTeams from "@/app/_hooks/useLeagueTeams";
import useNightDraft from "@/app/_hooks/useNightDraft";
import {DraftRound} from "@/app/_interfaces/round";
import {isByeTeam} from "@/app/_lib/bye";
import {ConferenceOf} from "@/app/_lib/conferences";
import {draftCounts, publishedAtLabel, publishLabel, publishNote, roundName, RoundStatus} from "@/app/_lib/roundStatus";
import {draftTableRows} from "@/app/_lib/ui/tables";
import {ConfirmRemove, EditToggle, NewTableButton, PairDialog, RowActions, useTableEdits} from "@/app/league/[leagueId]/daily-standings/ui/RoundEditing";
import {count, NOUN, weekdayDate} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, EmptyState, ErrorNote, IconCircleButton, LoadingRows, NARROW_DESKTOP, Spinner, TeamLabel} from "@/app/_ui/sp";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import React, {useEffect, useRef, useState} from "react";

// Upravljanje ligom · Skica (design mDraftView): the night's rounds created on Novo kolo wait here as drafts, Skica A,
// B, C… (a round gets its Kolo number when it is published). On the left one round's tables, which Uredi stolove
// re-pairs as on Dnevni poredak; on the right the list of the night's rounds: the admin approves them one by one or
// all at once and publishes the approved ones; the rest stay drafts. "Odbaci skicu" deletes the rounds not published
// yet. Once every round is out, the card says when and opens Dnevni poredak.

const STATUS_LOOK: Record<RoundStatus, {label: string; icon: React.ReactNode; ink: string; bg: string}> = {
  DRAFT: {label: "Skica", icon: <EditCalendarRoundedIcon />, ink: color.muted, bg: color.paper},
  APPROVED: {label: "Odobreno", icon: <CheckCircleRoundedIcon />, ink: color.navy, bg: tint.navy[12]},
  PUBLISHED: {label: "Objavljeno", icon: <VisibilityRoundedIcon />, ink: color.green, bg: tint.green[12]},
};

export default function DraftView({
  leagueId,
  date,
  onChanged,
  onDiscarded,
}: {
  leagueId: number;
  // the night (YYYY-MM-DD)
  date: string;
  // a round's status changed (the Skica and Kola tabs count them)
  onChanged: () => void;
  // the draft is gone: back to Novo kolo
  onDiscarded: () => void;
}) {
  const router = useTransitionRouter();
  const {night, error, reload, cur, setCur, busy, actionError, toggleApproval, approveAll, publish, discard} = useNightDraft(leagueId, date, {onChanged, onDiscarded});
  // the teams' conference dots, as on the night's tables
  const conferences = useConferences(leagueId);
  const [askDiscard, setAskDiscard] = useState(false);

  const grid = {flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 340px"}, gap: "20px"} as const;

  if (error && !night) {
    return (
      <Box sx={grid}>
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      </Box>
    );
  }
  if (!night || night.date !== date) {
    return (
      <Box sx={grid}>
        <Card sx={{overflow: "hidden", borderRadius: "24px"}}>
          <LoadingRows rows={8} height={58} />
        </Card>
        <Card sx={{borderRadius: "24px"}}>
          <LoadingRows rows={4} height={56} />
        </Card>
      </Box>
    );
  }

  const rounds = night.rounds;
  const index = Math.min(cur ?? 0, rounds.length - 1);
  const round = rounds[index];
  const counts = draftCounts(rounds);
  const allOut = counts.unpublished === 0;
  const lastOut = rounds.map((r) => r.publishedAt).filter((t): t is string => t != null).sort().pop() ?? null;

  return (
    <Box sx={grid}>
      <RoundCard
        leagueId={leagueId}
        date={date}
        rounds={rounds}
        index={index}
        onPick={setCur}
        onToggle={() => toggleApproval(round)}
        conferenceOf={conferences.of}
        onTablesChanged={() => {
          reload();
          onChanged();
        }}
      />
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        {actionError && <ErrorNote>{actionError}</ErrorNote>}
        {allOut ? (
          <Card
            component="section"
            aria-labelledby="draft-done"
            sx={{flex: "none", borderRadius: "24px", p: "22px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: `${shadow.card}, inset 0 0 0 2px ${tint.green[35]}`}}
          >
            <StatusTag ink={color.green} bg={tint.green[12]} icon={<VisibilityRoundedIcon />}>
              {lastOut ? `Objavljeno · ${publishedAtLabel(lastOut)}` : "Objavljeno"}
            </StatusTag>
            <Box component="h2" id="draft-done" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.1}}>
              Sva kola su objavljena
            </Box>
            <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink}}>
              Igrači sada vide svoje stolove, a Dnevni poredak prikazuje sva kola ove večeri.
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => router.push(`/league/${leagueId}/daily-standings?date=${date}`)}
              sx={{...buttonBase, height: 56, borderRadius: "16px", background: color.navy, color: color.white, fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", "& svg": {fontSize: 22}}}
            >
              <CalendarMonthRoundedIcon aria-hidden />
              Otvori Dnevni poredak
            </Box>
          </Card>
        ) : (
          <>
            <Box component="section" aria-labelledby="draft-publish" sx={{flex: "none", background: color.cream, borderRadius: "24px", p: "22px", display: "flex", flexDirection: "column", gap: "14px"}}>
              <StatusTag ink={color.navy} bg={color.white} icon={<VisibilityOffRoundedIcon />}>
                Skica · nije objavljeno
              </StatusTag>
              <Box component="h2" id="draft-publish" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.1}}>
                Odobri kola pa ih objavi
              </Box>
              <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink}}>
                Igrači i Dnevni poredak vide samo objavljena kola. Odobri jedno po jedno ili sva odjednom, pa objavi odobrena. Ostala ostaju u skici.
              </Box>
              <Box component="ul" aria-label="Kola ove večeri" sx={{listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "16px", overflow: "hidden"}}>
                {rounds.map((r, i) => (
                  <RoundListRow key={r.id} round={r} current={i === index} onOpen={() => setCur(i)} onToggle={() => toggleApproval(r)} />
                ))}
                {rounds.some((r) => r.status === "DRAFT") && (
                  <Box component="li">
                    <Box
                      component="button"
                      type="button"
                      onClick={approveAll}
                      sx={{...buttonBase, width: "100%", height: 48, background: color.paper2, color: color.navy, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", "& svg": {fontSize: 20}, "&:hover": {background: color.paper}}}
                    >
                      <DoneAllRoundedIcon aria-hidden />
                      Odobri sva kola
                    </Box>
                  </Box>
                )}
              </Box>
              <Box
                component="button"
                type="button"
                onClick={publish}
                disabled={counts.approved === 0 || busy != null}
                aria-busy={busy === "publish" || undefined}
                sx={{
                  ...buttonBase,
                  height: 60,
                  borderRadius: "18px",
                  background: counts.approved ? color.navy : color.lineFill,
                  color: counts.approved ? color.white : color.faint,
                  fontSize: 18,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: counts.approved ? shadow.action : "none",
                  "&:disabled": {cursor: counts.approved ? "progress" : "not-allowed"},
                  "& svg": {fontSize: 24},
                }}
              >
                {busy === "publish" ? <Spinner size={22} tone="white" /> : <PublishRoundedIcon aria-hidden />}
                {publishLabel(counts)}
              </Box>
              <Box role="status" sx={{fontSize: 13, color: color.ink2, textAlign: "center"}}>
                {publishNote(counts)}
              </Box>
            </Box>
            <DiscardCard
              unpublished={counts.unpublished}
              published={counts.published}
              asking={askDiscard}
              busy={busy === "discard"}
              onAsk={() => setAskDiscard(true)}
              onCancel={() => setAskDiscard(false)}
              onConfirm={discard}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

// The left card: one round's tables, with arrows and a switch between the night's rounds, its status and its approval.
// A round not published yet can be edited (Uredi stolove): a click on a table re-pairs it, Novi stol adds one and the
// bin removes one, as on Dnevni poredak.
function RoundCard({
  leagueId,
  date,
  rounds,
  index,
  onPick,
  onToggle,
  conferenceOf,
  onTablesChanged,
}: {
  leagueId: number;
  date: string;
  rounds: DraftRound[];
  index: number;
  onPick: (i: number) => void;
  onToggle: () => void;
  conferenceOf: ConferenceOf;
  onTablesChanged: () => void;
}) {
  const round = rounds[index];
  const name = roundName(round);
  const look = STATUS_LOOK[round.status];
  const editable = round.status !== "PUBLISHED";
  const [editing, setEditing] = useState(false);
  const edits = useTableEdits(editable ? {leagueId, date, roundNumber: round.roundNumber, onChanged: onTablesChanged} : null);
  const {teams} = useLeagueTeams(editing ? leagueId : null);
  const rows = draftTableRows(round, conferenceOf);
  // another round (or this one published) ends the editing
  useEffect(() => {
    setEditing(false);
    edits.reset();
    edits.setPair(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, editable]);
  const toggleEdit = () => {
    setEditing((e) => !e);
    edits.reset();
  };
  const arrow = {width: 44, height: 44, border: `1.5px solid ${color.borderControl}`, boxShadow: "none", "&:hover:not(:disabled)": {boxShadow: "none", background: color.paper2}, "& svg": {fontSize: 26}};
  // a night with many rounds scrolls the switch sideways: the open round stays in view
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabs.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({block: "nearest", inline: "nearest"});
  }, [index]);
  const rowGrid = `34px minmax(0,1fr) 28px minmax(0,1fr) ${editing ? "72px" : "34px"}`;
  return (
    <Card component="section" aria-label={`${name}, stolovi`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "16px 18px"}}>
        <IconCircleButton label="Prethodno kolo" onClick={() => onPick(index - 1)} disabled={index === 0} sx={arrow}>
          <ChevronLeftRoundedIcon />
        </IconCircleButton>
        {/* the round's name stays whole; the switch beside it scrolls instead */}
        <Box sx={{flex: "1 0 130px", minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted, ...ellipsis}}>
            {weekdayDate(date)}
          </Box>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, ...ellipsis}}>
            {name}
          </Box>
        </Box>
        <Box ref={tabs} role="tablist" aria-label="Kola ove večeri" sx={{flex: "0 1 auto", minWidth: 0, display: "flex", gap: "4px", p: "4px", borderRadius: "14px", background: color.lineFill, overflowX: "auto", scrollbarWidth: "none"}}>
          {rounds.map((r, i) => {
            const on = i === index;
            const l = STATUS_LOOK[r.status];
            return (
              <Box
                key={r.id}
                component="button"
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`${roundName(r)}, ${l.label.toLowerCase()}`}
                onClick={() => onPick(i)}
                sx={{
                  ...buttonBase,
                  flex: "none",
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  px: "14px",
                  borderRadius: "10px",
                  background: on ? color.white : "transparent",
                  color: on ? color.ink : color.ink2,
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  boxShadow: on ? shadow.pill : "none",
                  "& svg": {fontSize: 18, color: r.status === "DRAFT" ? tint.navy[30] : l.ink},
                }}
              >
                {l.icon}
                {roundName(r)}
              </Box>
            );
          })}
        </Box>
        <IconCircleButton label="Sljedeće kolo" onClick={() => onPick(index + 1)} disabled={index === rounds.length - 1} sx={arrow}>
          <ChevronRightRoundedIcon />
        </IconCircleButton>
      </Box>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", p: "0 18px 14px"}}>
        <StatusTag ink={look.ink} bg={look.bg} icon={look.icon} height={30}>
          {look.label}
        </StatusTag>
        <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 14, color: color.muted, whiteSpace: "nowrap"}}>
          {count(round.tables.length, NOUN.stol)}
        </Box>
        {editable && editing && <NewTableButton onClick={() => edits.setPair({kind: "new", tableNumber: rows.reduce((m, r) => Math.max(m, r.table), 0) + 1})} />}
        {editable && <EditToggle editing={editing} onClick={toggleEdit} />}
        {editable && !editing && (
          <ApproveButton approved={round.status === "APPROVED"} onClick={onToggle} label={round.status === "APPROVED" ? "Odobreno" : "Odobri ovo kolo"} big />
        )}
      </Box>
      {edits.actionError && <ErrorNote sx={{m: "0 18px 14px"}}>{edits.actionError}</ErrorNote>}
      <Box
        aria-hidden
        sx={{flex: "none", height: 36, display: "flex", alignItems: "center", px: "18px", borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${tint.navy[12]}`, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
      >
        {editing ? "Stol · parovi · klikni stol za promjenu para" : "Stol · parovi"}
      </Box>
      {rows.length === 0 ? (
        <EmptyState>Ovo kolo nema stolova.</EmptyState>
      ) : (
        <Box
          component="ul"
          aria-label={`${name}: ${count(rows.length, NOUN.stol)}`}
          // two columns of tables; under 1280 px wide one, so the teams' names fit
          sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr)"}, alignContent: "start", columnGap: "1px", background: color.divider}}
        >
          {rows.map((t) =>
            editing && edits.confirmId === t.id ? (
              <Box component="li" key={t.id} sx={{height: 58, display: "flex", alignItems: "center", gap: "6px", pl: "18px", pr: "8px", borderBottom: `1px solid ${color.divider}`, background: tint.red[8]}}>
                <ConfirmRemove t={t} busy={edits.removing} onCancel={() => edits.setConfirmId(null)} onConfirm={() => edits.remove(t.id)} />
              </Box>
            ) : (
              <Box
                component="li"
                key={t.id}
                onClick={editing ? () => edits.setPair({kind: "edit", row: t}) : undefined}
                sx={{
                  background: editing && t.table === edits.freshTable ? color.cream2 : color.white,
                  height: 58,
                  display: "grid",
                  gridTemplateColumns: rowGrid,
                  gap: "10px",
                  alignItems: "center",
                  px: "18px",
                  borderBottom: `1px solid ${color.divider}`,
                  ...(editing && {cursor: "pointer", "&:hover": {background: color.paper2}}),
                }}
              >
                <Box component="span" sx={{width: 34, height: 34, borderRadius: "10px", background: color.paper, color: color.navy, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums"}}>
                  <Box component="span" sx={{position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)"}}>
                    Stol{" "}
                  </Box>
                  {t.table}
                </Box>
                <TeamLabel name={t.teamA} conference={t.conferenceA} end sx={{fontSize: 16, fontWeight: 600, ...(isByeTeam(t.teamAId) && {color: color.muted})}} />
                <Box component="span" sx={{textAlign: "center", fontSize: 13, color: color.faint}}>
                  {t.bye ? `${t.winsA}:${t.winsB}` : "vs"}
                </Box>
                <TeamLabel name={t.teamB} conference={t.conferenceB} sx={{fontSize: 16, fontWeight: 600, ...(isByeTeam(t.teamBId) && {color: color.muted})}} />
                {editing ? (
                  <RowActions
                    t={t}
                    onEdit={() => edits.setPair({kind: "edit", row: t})}
                    onRemove={() => {
                      edits.setConfirmId(t.id);
                      edits.setActionError(null);
                    }}
                  />
                ) : (
                  <Box component="span" sx={{display: "flex", justifyContent: "flex-end"}}>
                    {t.smoking && <SmokingMark />}
                  </Box>
                )}
              </Box>
            )
          )}
        </Box>
      )}
      {editing && edits.pair && (
        <PairDialog target={edits.pair} rows={rows} teams={teams ?? []} roundLabel={name} onClose={() => edits.setPair(null)} onSave={edits.savePair} conferenceOf={conferenceOf} />
      )}
    </Card>
  );
}

// A round in the right card's list: its name and status (a click opens it on the left) and its approval
function RoundListRow({round, current, onOpen, onToggle}: {round: DraftRound; current: boolean; onOpen: () => void; onToggle: () => void}) {
  const look = STATUS_LOOK[round.status];
  return (
    <Box component="li" sx={{height: 56, display: "flex", alignItems: "center", gap: "10px", pl: "14px", pr: "8px", borderBottom: `1px solid ${color.divider}`}}>
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        aria-current={current || undefined}
        sx={{...buttonBase, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px", textAlign: "left"}}
      >
        <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
          {roundName(round)}
        </Box>
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "4px", fontSize: 12.5, fontWeight: 600, color: look.ink, "& svg": {fontSize: 15}}}>
          {look.icon}
          {look.label}
        </Box>
      </Box>
      {round.status !== "PUBLISHED" && (
        <ApproveButton approved={round.status === "APPROVED"} onClick={onToggle} label={round.status === "APPROVED" ? "Odobreno" : "Odobri"} roundName={roundName(round)} />
      )}
    </Box>
  );
}

// "Odobri" / "Odobreno": a second click on an approved round takes the approval back
function ApproveButton({approved, onClick, label, big = false, roundName}: {approved: boolean; onClick: () => void; label: string; big?: boolean; roundName?: string}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={approved}
      aria-label={roundName != null ? `${approved ? "Odobreno" : "Odobri"}: ${roundName}` : undefined}
      title={approved ? "Klikni za poništavanje odobrenja" : undefined}
      sx={{
        ...buttonBase,
        flex: "none",
        height: big ? 44 : 40,
        display: "flex",
        alignItems: "center",
        gap: big ? "8px" : "6px",
        pl: big ? "12px" : "10px",
        pr: big ? "16px" : "12px",
        border: `1.5px solid ${approved ? color.navy : tint.navy[25]}`,
        borderRadius: big ? "14px" : "12px",
        background: approved ? color.navy : color.white,
        color: approved ? color.white : color.navy,
        fontSize: big ? 15 : 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        transition: "background 160ms ease, color 160ms ease",
        "& svg": {fontSize: big ? 20 : 18},
      }}
    >
      {approved ? <CheckRoundedIcon aria-hidden /> : <CheckCircleRoundedIcon aria-hidden />}
      {label}
    </Box>
  );
}

function StatusTag({ink, bg, icon, height = 28, children}: {ink: string; bg: string; icon: React.ReactNode; height?: number; children: React.ReactNode}) {
  return (
    <Box
      component="span"
      sx={{alignSelf: "flex-start", flex: "none", height, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: height > 28 ? "10px" : "9px", background: bg, color: ink, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", "& svg": {fontSize: 18}}}
    >
      {icon}
      {children}
    </Box>
  );
}

// "Nešto ne valja?": discarding the draft asks first; published rounds stay
function DiscardCard({
  unpublished,
  published,
  asking,
  busy,
  onAsk,
  onCancel,
  onConfirm,
}: {
  unpublished: number;
  published: number;
  asking: boolean;
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const small = {...buttonBase, flex: 1, height: 44, borderRadius: "12px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", "& svg": {fontSize: 18}} as const;
  const what = `Obrisat će se ${count(unpublished, NOUN.neobjavljenoKolo)} ove večeri.`;
  return (
    <Card component="section" aria-labelledby="draft-discard" sx={{flex: "none", borderRadius: "24px", p: "18px 20px", display: "flex", flexDirection: "column", gap: "10px"}}>
      <Box component="h2" id="draft-discard" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
        Nešto ne valja?
      </Box>
      {asking ? (
        <Box role="alert" sx={{display: "flex", flexDirection: "column", gap: "12px", p: "12px 14px", borderRadius: "16px", border: `1.5px solid ${tint.red[35]}`, background: tint.red[6]}}>
          <Box sx={{display: "flex", gap: "10px", "& > svg": {fontSize: 22, color: color.red, flex: "none"}}}>
            <WarningRoundedIcon aria-hidden />
            <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
              <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
                Odbaciti skicu?
              </Box>
              <Box component="span" sx={{fontSize: 13, lineHeight: 1.45, color: color.ink2}}>
                {what} {published ? "Objavljena kola ostaju." : "Ništa se ne objavljuje."}
              </Box>
            </Box>
          </Box>
          <Box sx={{display: "flex", gap: "8px"}}>
            <Box component="button" type="button" onClick={onCancel} disabled={busy} sx={{...small, border: `1.5px solid ${tint.navy[25]}`, background: color.white, color: color.navy}}>
              Odustani
            </Box>
            <Box component="button" type="button" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} sx={{...small, background: color.red, color: color.white}}>
              {busy ? <Spinner size={18} tone="white" /> : <DeleteRoundedIcon aria-hidden />}
              Odbaci skicu
            </Box>
          </Box>
        </Box>
      ) : (
        <>
          <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.5, color: color.ink2}}>
            {published ? "Odbaci neobjavljena kola i vrati se na Novo kolo. Objavljena kola ostaju." : "Odbaci skicu i vrati se na Novo kolo. Ništa se ne objavljuje."}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={onAsk}
            sx={{...buttonBase, height: 48, border: `1.5px solid ${tint.red[35]}`, borderRadius: "14px", background: color.white, color: color.red, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", "& svg": {fontSize: 20}, "&:hover": {background: tint.red[6]}}}
          >
            <DeleteRoundedIcon aria-hidden />
            Odbaci skicu
          </Box>
        </>
      )}
    </Card>
  );
}
