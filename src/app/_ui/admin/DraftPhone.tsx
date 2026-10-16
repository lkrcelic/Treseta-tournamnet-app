"use client";

import useConferences from "@/app/_hooks/useConferences";
import useLeagues from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import useNightDraft from "@/app/_hooks/useNightDraft";
import {DraftRound} from "@/app/_interfaces/round";
import {nightLabel} from "@/app/_lib/nights";
import {draftCounts, publishedTimeLabel, publishLabel, publishNote, RoundStatus} from "@/app/_lib/roundStatus";
import {count, NOUN} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, shadow, tint} from "@/app/_styles/tokens";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {buttonBase, ConfirmSheet, ErrorNote, IconCircleButton, LoadingRows, PrimaryButton, Screen, ScrollArea, tabular, TeamLabel, TopBar} from "@/app/_ui/sp";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {Box} from "@mui/material";
import React, {useEffect, useRef, useState} from "react";

const LOOK: Record<RoundStatus, {label: string; icon: React.ReactNode; ink: string; bg: string}> = {
  DRAFT: {label: "Skica", icon: <EditCalendarRoundedIcon />, ink: color.muted, bg: color.lineFill},
  APPROVED: {label: "Odobreno", icon: <CheckCircleRoundedIcon />, ink: color.navy, bg: tint.navy[12]},
  PUBLISHED: {label: "Objavljeno", icon: <VisibilityRoundedIcon />, ink: color.green, bg: tint.green[12]},
};

// Skica kola on the phone (admin-mobile 14–17): the night's rounds as a switch, one round's tables, its approval, and
// at the bottom "Odobri sva" and "Objavi odobrena kola · 1/3" (only approved rounds go out; the rest stay drafts until
// later). Odbaci skicu (the bin) deletes the rounds not published yet and goes back to Novo kolo. Once every round is
// out it says so and opens Dnevni poredak. The rules and calls are the desktop's (useNightDraft).
export default function DraftPhone({leagueId, date}: {leagueId: number; date: string}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Skica kola", "/");
  const leagues = useLeagues(leagueId);
  const league = leagues.find((l) => l.id === leagueId);
  const d = useNightDraft(leagueId, date, {
    onDiscarded: () => router.replace(`/league/${leagueId}/manage?view=create`, "back"),
  });
  const [askDiscard, setAskDiscard] = useState(false);
  // the teams' conference dots, as on the desktop's Skica (Treseta)
  const conferences = useConferences(leagueId);

  const night = d.night && d.night.date === date ? d.night : null;
  const rounds = night?.rounds ?? [];
  const index = Math.min(d.cur ?? 0, Math.max(rounds.length - 1, 0));
  const round = rounds[index] as DraftRound | undefined;
  const counts = draftCounts(rounds);
  const allOut = rounds.length > 0 && counts.unpublished === 0;
  const lastOut = rounds.map((r) => r.publishedAt).filter((t): t is string => t != null).sort().pop() ?? null;

  return (
    <Screen fill gap={14}>
      <TopBar
        onBack={nav.back}
        eyebrow={`${league?.name ?? "Liga"} · ${nightLabel(date)}`}
        title="Skica kola"
        right={
          night && counts.unpublished > 0 ? (
            <IconCircleButton label="Odbaci skicu" size={44} onClick={() => setAskDiscard(true)} sx={{color: color.red, "& svg": {fontSize: 22}}}>
              <DeleteRoundedIcon />
            </IconCircleButton>
          ) : undefined
        }
      />

      {d.error && !night ? (
        <ErrorNote onRetry={d.reload}>{d.error}</ErrorNote>
      ) : !night || !round ? (
        <Box sx={{background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          <LoadingRows rows={8} height={58} />
        </Box>
      ) : (
        <>
          <RoundSwitch rounds={rounds} index={index} onPick={d.setCur} />

          <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", minHeight: 44}}>
            <StatusPill status={round.status} />
            <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 15, color: color.ink2, whiteSpace: "nowrap"}}>
              {count(round.tables.length, NOUN.stol)}
            </Box>
            {round.status !== "PUBLISHED" && <ApproveButton approved={round.status === "APPROVED"} onClick={() => d.toggleApproval(round)} round={round.roundNumber} />}
          </Box>

          <ScrollArea sx={{gap: "12px"}}>
            {allOut && (
              <Box
                role="status"
                sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "14px 16px", borderRadius: "20px", background: color.white, boxShadow: `inset 0 0 0 2px ${tint.green[35]}`, "& > svg": {fontSize: 30, color: color.green, flex: "none"}}}
              >
                <TaskAltRoundedIcon />
                <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
                    Sva kola su objavljena
                  </Box>
                  <Box component="span" sx={{fontSize: 13.5, color: color.ink2}}>
                    {lastOut ? `Igrači vide svoje stolove od ${publishedTimeLabel(lastOut)}.` : "Igrači vide svoje stolove."}
                  </Box>
                </Box>
              </Box>
            )}
            <Box component="ol" aria-label={`Kolo ${round.roundNumber}, stolovi`} sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
              {round.tables.map((t, i) => (
                <Box
                  component="li"
                  key={t.id}
                  sx={{minHeight: 64, display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto minmax(0,1fr) 24px", alignItems: "center", gap: "10px", p: "8px 14px", borderTop: i ? `1px solid ${color.line}` : "none"}}
                >
                  <Box component="span" sx={{width: 36, height: 36, borderRadius: "10px", background: color.lineFill, color: color.navy, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", ...tabular}}>
                    {t.table ?? i + 1}
                  </Box>
                  <TeamLabel name={t.team1.name} conference={conferences.of(t.team1.id)} end sx={{fontSize: 15.5, fontWeight: 600}} />
                  <Box component="span" aria-label="protiv" sx={{fontSize: 12, color: color.faint}}>
                    vs
                  </Box>
                  <TeamLabel name={t.team2.name} conference={conferences.of(t.team2.id)} sx={{fontSize: 15.5, fontWeight: 600}} />
                  {t.smoking ? <SmokingMark /> : <span />}
                </Box>
              ))}
            </Box>
          </ScrollArea>

          <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
            {d.actionError && <ErrorNote>{d.actionError}</ErrorNote>}
            {allOut ? (
              <PrimaryButton icon={<CalendarMonthRoundedIcon />} onClick={() => router.push(`/league/${leagueId}/daily-standings?date=${date}`)}>
                Otvori Dnevni poredak
              </PrimaryButton>
            ) : (
              <>
                <Box sx={{display: "flex", alignItems: "center", gap: "10px", minHeight: 44}}>
                  <Box component="span" role="status" sx={{flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.35, color: color.ink2}}>
                    {publishNote(counts)}
                  </Box>
                  {rounds.some((r) => r.status === "DRAFT") && (
                    <Box
                      component="button"
                      type="button"
                      onClick={d.approveAll}
                      sx={{...buttonBase, flex: "none", height: 44, px: "10px", borderRadius: "12px", color: color.navy, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 20}}}
                    >
                      <DoneAllRoundedIcon aria-hidden />
                      Odobri sva
                    </Box>
                  )}
                </Box>
                <PrimaryButton
                  icon={<PublishRoundedIcon />}
                  onClick={d.publish}
                  disabled={counts.approved === 0}
                  loading={d.busy === "publish"}
                  bg={counts.approved ? color.navy : color.lineFill}
                  ink={counts.approved ? color.white : color.faint}
                  sx={counts.approved ? undefined : {opacity: 1, boxShadow: "none"}}
                >
                  {publishLabel(counts)}
                </PrimaryButton>
              </>
            )}
          </Box>
        </>
      )}

      <ConfirmSheet
        open={askDiscard}
        onClose={() => setAskDiscard(false)}
        onConfirm={async () => {
          if (await d.discard()) setAskDiscard(false);
        }}
        title="Odbaciti skicu?"
        text="Neobjavljena kola se brišu. Objavljena kola ostaju."
        action="Odbaci"
        icon={<DeleteRoundedIcon />}
        busy={d.busy === "discard"}
        error={askDiscard ? d.actionError : null}
      />
    </Screen>
  );
}

// Kolo 1 · Kolo 2 · Kolo 3, each with its status icon, on a beige track; a night of many rounds scrolls sideways
function RoundSwitch({rounds, index, onPick}: {rounds: DraftRound[]; index: number; onPick: (i: number) => void}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({block: "nearest", inline: "nearest"});
  }, [index]);
  return (
    <Box
      ref={box}
      role="group"
      aria-label="Kola ove večeri"
      sx={{flex: "none", display: "flex", gap: "4px", p: "4px", borderRadius: "16px", background: color.lineFill, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": {display: "none"}}}
    >
      {rounds.map((r, i) => {
        const on = i === index;
        const look = LOOK[r.status];
        return (
          <Box
            key={r.roundNumber}
            component="button"
            type="button"
            aria-pressed={on}
            aria-label={`Kolo ${r.roundNumber}, ${look.label.toLowerCase()}`}
            onClick={() => onPick(i)}
            sx={{
              ...buttonBase,
              flex: "1 0 auto",
              minWidth: 92,
              height: 44,
              px: "12px",
              borderRadius: "12px",
              background: on ? color.white : "transparent",
              color: on ? color.ink : color.ink2,
              boxShadow: on ? shadow.segment : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: 15,
              fontWeight: on ? 700 : 600,
              whiteSpace: "nowrap",
              "& svg": {fontSize: 18, color: r.status === "DRAFT" ? tint.navy[35] : look.ink},
            }}
          >
            {look.icon}
            Kolo {r.roundNumber}
          </Box>
        );
      })}
    </Box>
  );
}

// the round's status; on a phone under 375 px only its icon, so the tables' count and Odobri keep their room
function StatusPill({status}: {status: RoundStatus}) {
  const look = LOOK[status];
  return (
    <Box
      component="span"
      role="img"
      aria-label={look.label}
      sx={{flex: "none", height: 32, display: "flex", alignItems: "center", gap: "5px", px: "10px", borderRadius: "10px", background: look.bg, color: look.ink, fontSize: 14, fontWeight: 700, "& svg": {fontSize: 18}, "@media (max-width: 374.98px)": {px: "7px"}}}
    >
      {look.icon}
      <Box component="span" aria-hidden sx={{"@media (max-width: 374.98px)": {display: "none"}}}>
        {look.label}
      </Box>
    </Box>
  );
}

// Odobri / Odobreno: approves the round, and a second press takes the approval back
function ApproveButton({approved, onClick, round}: {approved: boolean; onClick: () => void; round: number}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={approved}
      aria-label={approved ? `Kolo ${round} je odobreno. Poništi odobrenje` : `Odobri kolo ${round}`}
      onClick={onClick}
      sx={{
        ...buttonBase,
        flex: "none",
        height: 44,
        px: "16px",
        borderRadius: "14px",
        border: `1.5px solid ${approved ? color.navy : tint.navy[25]}`,
        background: approved ? color.navy : color.white,
        color: approved ? color.white : color.navy,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: 16,
        fontWeight: 600,
        transition: "background 160ms ease, color 160ms ease",
        "& svg": {fontSize: 20},
      }}
    >
      {approved ? <CheckRoundedIcon aria-hidden /> : <CheckCircleOutlineRoundedIcon aria-hidden />}
      {approved ? "Odobreno" : "Odobri"}
    </Box>
  );
}
