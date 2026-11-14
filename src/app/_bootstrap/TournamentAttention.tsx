"use client";

import {answerAttendanceAPI, getAttentionAPI} from "@/app/_fetchers/tournament";
import useStartGame from "@/app/_hooks/useStartGame";
import {clockLabel} from "@/app/_lib/gameTime";
import type {Attention, AttentionNotice, AttentionPrompt} from "@/app/_lib/service/tournament/attention";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import {color, font, tint} from "@/app/_styles/tokens";
import {ErrorNote, OutlineButton, PrimaryButton} from "@/app/_ui/sp";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import LockClockRoundedIcon from "@mui/icons-material/LockClockRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import TimerOffRoundedIcon from "@mui/icons-material/TimerOffRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";

// Nedolazak za stol on the players' phones (Claude Design "Nedolazak za stol" N2–N4, N7). On a tournament day the app
// asks the server, on every screen, whether the player's table is waiting for an answer: 4 minutes after the Kolo went
// out with no game started, "Jesu li … za stolom?" covers the app and can't be closed (no X, no Back; it is there again
// after a reload) until someone of the table answers; Da, tu su works at once, Ne, nisu došli from 6 minutes (a team
// walking to its table is still in time). Da, tu su opens the game; Ne,
// nisu došli asks once more what happens, then the table is won as a Slobodna runda is (NO_SHOW_SCORE). A skipped match (10 minutes, no answer) is
// told once (Razumijem). The server decides every time; the phone only counts down. Never on the login pages.

const SEEN_KEY = "bela.skippedSeen";
const RED_FROM_MS = 2 * 60_000;

function seenSkipped(): number[] {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function markSkipped(roundId: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seenSkipped().slice(-30), roundId]));
  } catch {
    // private mode: it may show again
  }
}

const clockOf = (iso: string) => new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(new Date(iso));

export default function TournamentAttention() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const [data, setData] = useState<Attention | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"PRESENT" | "NO_SHOW" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const router = useTransitionRouter();
  const game = useStartGame({scope: "tournament"});

  const quiet = ["/login", "/signup"].some((p) => pathname.startsWith(p));

  const check = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      const next = await getAttentionAPI();
      setData(next);
      setOffset(Date.parse(next.now) - Date.now());
      timer.current = window.setTimeout(check, next.poll_in * 1000);
    } catch {
      // offline or logged out: try again in a minute
      timer.current = window.setTimeout(check, 60_000);
    }
  }, []);

  useEffect(() => {
    if (!user || quiet) return;
    check();
    const wake = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [user, quiet, check]);

  const prompt = data?.prompt && data.prompt.round_id !== dismissed ? data.prompt : null;
  const notice = !prompt ? (data?.notices ?? []).find((n) => !seenSkipped().includes(n.round_id)) ?? null : null;

  // the countdowns tick every second while something is shown
  useEffect(() => {
    if (!prompt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [prompt]);

  if (!user || quiet || (!prompt && !notice)) return null;
  const serverNow = now + offset;

  const answer = async (kind: "PRESENT" | "NO_SHOW") => {
    if (!prompt || busy) return;
    setBusy(kind);
    setError(null);
    try {
      const {outcome} = await answerAttendanceAPI(prompt.round_id, kind);
      setDismissed(prompt.round_id);
      setConfirming(false);
      if (outcome === "PRESENT" || outcome === "STARTED") await game.start();
      else router.push(`/turniri/${prompt.tournament_id}`);
      check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Odgovor nije spremljen.");
      check();
    }
    setBusy(null);
  };

  if (prompt) {
    return confirming ? (
      <NoShowConfirm p={prompt} serverNow={serverNow} busy={busy === "NO_SHOW"} error={error} onConfirm={() => answer("NO_SHOW")} onBack={() => setConfirming(false)} />
    ) : (
      <Question p={prompt} serverNow={serverNow} busy={busy} error={error ?? game.error} onPresent={() => answer("PRESENT")} onAbsent={() => setConfirming(true)} />
    );
  }
  return (
    <Skipped
      n={notice!}
      onClose={() => {
        markSkipped(notice!.round_id);
        setData((d) => (d ? {...d} : d));
        router.push(`/turniri/${notice!.tournament_id}`);
      }}
    />
  );
}

// The screen over the app: the paper sheet from just below the top, scrolling if it has to
function Cover({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <Box role="alertdialog" aria-modal="true" aria-label={label} sx={{position: "fixed", inset: 0, zIndex: 1500, background: tint.scrim[42], display: "flex", justifyContent: "center"}}>
      <Box
        sx={{
          mt: "calc(14px + env(safe-area-inset-top))",
          width: "100%",
          maxWidth: 560,
          borderRadius: "28px 28px 0 0",
          background: color.paper,
          p: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          overflowY: "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function TableChip({p}: {p: {kolo: number; table_number: number | null}}) {
  return (
    <Box component="span" sx={{alignSelf: "flex-start", px: "10px", py: "5px", borderRadius: "9px", background: color.navy, color: color.white, fontSize: 13, fontWeight: 700}}>
      Kolo {p.kolo}
      {p.table_number != null && ` · Stol ${p.table_number}`}
    </Box>
  );
}

// "Preskače se za 5:00": cream, red in the last 2 minutes
function SkipPill({ms}: {ms: number}) {
  const red = ms <= RED_FROM_MS;
  return (
    <Box
      component="span"
      role="timer"
      sx={{display: "inline-flex", alignItems: "center", gap: "5px", px: "10px", py: "5px", borderRadius: "999px", background: red ? color.red : color.cream, color: red ? color.white : color.ink, fontSize: 13, fontWeight: 700, "& svg": {fontSize: 16}}}
    >
      <TimerRoundedIcon aria-hidden />
      Preskače se za {clockLabel(ms)}
    </Box>
  );
}

function Title({children}: {children: React.ReactNode}) {
  return (
    <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 31, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.01em", overflowWrap: "anywhere"}}>
      {children}
    </Box>
  );
}

type Row = {icon: React.ReactNode; tone?: "red" | "green" | "plain"; title: string; text: string};

// The white card of outcomes: an icon tile, a bold line and its explanation
function Rows({rows}: {rows: Row[]}) {
  return (
    <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "18px", background: color.white, display: "flex", flexDirection: "column"}}>
      {rows.map((r, i) => (
        <Box component="li" key={r.title} sx={{display: "flex", gap: "12px", p: "13px 14px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
          <Box
            aria-hidden
            sx={{
              flex: "none",
              width: 30,
              height: 30,
              borderRadius: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: r.tone === "red" ? tint.red[12] : r.tone === "green" ? tint.green[12] : color.paper,
              color: r.tone === "red" ? color.red : r.tone === "green" ? color.green : color.ink2,
              "& svg": {fontSize: 18},
            }}
          >
            {r.icon}
          </Box>
          <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
              {r.title}
            </Box>
            <Box component="span" sx={{fontSize: 14, lineHeight: 1.4, color: color.ink2}}>
              {r.text}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const NO_SHOW = `${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]}`;
const perMatch = (p: AttentionPrompt) => (p.matches_per_round > 1 ? `${NO_SHOW} po partiji` : NO_SHOW);

function Question({p, serverNow, busy, error, onPresent, onAbsent}: {p: AttentionPrompt; serverNow: number; busy: "PRESENT" | "NO_SHOW" | null; error: string | null; onPresent: () => void; onAbsent: () => void}) {
  const toSkip = Date.parse(p.skip_at) - serverNow;
  const toUnlock = Date.parse(p.unlock_at) - serverNow;
  const locked = toUnlock > 0;
  const minutes = Math.max(0, Math.floor((serverNow - Date.parse(p.published_at)) / 60_000));
  const button = {height: 56, fontSize: 16, borderRadius: "16px"} as const;
  return (
    <Cover label={`Jesu li ${p.opponent} za stolom?`}>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap"}}>
        <TableChip p={p} />
        <SkipPill ms={toSkip} />
      </Box>
      <Title>Jesu li {p.opponent} za stolom?</Title>
      <Box sx={{fontSize: 16, lineHeight: 1.45, color: color.ink2}}>
        Kolo je počelo prije {minutes} {minutes === 1 ? "minutu" : minutes >= 2 && minutes <= 4 ? "minute" : "minuta"}, a igra za vašim stolom još nije započela.
      </Box>
      <Rows
        rows={[
          {icon: <GroupsRoundedIcon />, title: "Da, tu su", text: "Upit se zatvara i počinjete igru."},
          {icon: <EmojiEventsRoundedIcon />, title: "Ne, nisu došli", text: `Dobivate ${perMatch(p)}, a ${p.opponent} ispadaju iz turnira.`},
          {icon: <TimerOffRoundedIcon />, tone: "red", title: `Bez odgovora do ${clockOf(p.skip_at)}`, text: "Meč se preskače i obje ekipe ispadaju iz ostatka turnira."},
        ]}
      />
      <Box sx={{flex: 1, minHeight: 8}} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton
        icon={<GroupsRoundedIcon />}
        onClick={onPresent}
        disabled={busy != null}
        loading={busy === "PRESENT"}
        sx={button}
      >
        Da, tu su · započni igru
      </PrimaryButton>
      {locked && (
        <Box sx={{display: "flex", alignItems: "center", gap: "12px", p: "12px 14px", borderRadius: "16px", background: color.white, border: `1px solid ${color.line}`}}>
          <LockClockRoundedIcon aria-hidden sx={{fontSize: 24, color: color.ink2}} />
          <Box sx={{flex: 1, fontSize: 14.5, lineHeight: 1.4, color: color.ink}}>„Ne, nisu došli” je moguće od {clockOf(p.unlock_at)}. Pričekajte protivnika.</Box>
          <Box component="span" role="timer" sx={{px: "10px", py: "6px", borderRadius: "10px", background: color.navy, color: color.white, fontFamily: font.display, fontSize: 18, fontWeight: 800}}>
            {clockLabel(toUnlock)}
          </Box>
        </Box>
      )}
      <OutlineButton
        tone={locked ? color.muted : color.red}
        onClick={onAbsent}
        disabled={locked || busy != null}
        sx={{...button, borderWidth: "1.5px", background: locked ? color.lineFill : color.white, borderColor: locked ? color.lineFill : tint.red[35], "& svg": {fontSize: 20}}}
      >
        <PersonOffRoundedIcon aria-hidden />
        Ne, nisu došli
      </OutlineButton>
      <Box sx={{textAlign: "center", fontSize: 13, color: color.muted}}>Ovaj upit se ne može zatvoriti dok ne odgovorite.</Box>
    </Cover>
  );
}

function NoShowConfirm({p, serverNow, busy, error, onConfirm, onBack}: {p: AttentionPrompt; serverNow: number; busy: boolean; error: string | null; onConfirm: () => void; onBack: () => void}) {
  const first = p.kolo === 1;
  return (
    <Cover label={`${p.opponent} nisu došli?`}>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap"}}>
        <TableChip p={p} />
        <SkipPill ms={Date.parse(p.skip_at) - serverNow} />
      </Box>
      <Title>{p.opponent} nisu došli?</Title>
      <Box sx={{fontSize: 16, color: color.ink2}}>Kad potvrdite, odmah se događa ovo:</Box>
      <Rows
        rows={[
          {icon: <EmojiEventsRoundedIcon />, tone: "green", title: `${p.my_team} pobjeđuju`, text: `${perMatch(p)}, kao da je meč odigran.`},
          {icon: <PersonOffRoundedIcon />, tone: "red", title: `${p.opponent} ispadaju iz turnira`, text: "Ne igraju ostala kola. Odigrana kola ostaju u poretku."},
          {icon: <HourglassTopRoundedIcon />, title: `Čekate Kolo ${p.kolo + 1}`, text: "Počinje kad svi stolovi završe."},
        ]}
      />
      <Box sx={{display: "flex", gap: "10px", p: "12px 14px", borderRadius: "16px", background: tint.gold[16], color: color.ink, fontSize: 14, lineHeight: 1.45, "& svg": {fontSize: 20, flex: "none", mt: "1px"}}}>
        <WarningRoundedIcon aria-hidden />
        <span>
          {first
            ? `${p.opponent} dobivaju i zabranu prijava na turnire na mjesec dana: u 1. kolu nedolazak znači zabranu, jer je ekipa potvrdila dolazak.`
            : `${p.opponent} ne dobivaju zabranu prijava. Zabrana vrijedi samo za nedolazak u 1. kolu, jer je ekipa potvrdila dolazak. U ostalim kolima moguć je iznenadni slučaj.`}
        </span>
      </Box>
      <Box sx={{flex: 1, minHeight: 8}} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton icon={<CheckRoundedIcon />} bg={color.red} onClick={onConfirm} loading={busy} sx={{height: 56, fontSize: 16}}>
        Potvrđujem, nisu došli
      </PrimaryButton>
      <OutlineButton onClick={onBack} disabled={busy} sx={{height: 52, borderWidth: "1.5px", borderColor: color.line, background: color.white}}>
        Ipak su tu
      </OutlineButton>
    </Cover>
  );
}

function Skipped({n, onClose}: {n: AttentionNotice; onClose: () => void}) {
  return (
    <Cover label="Meč je preskočen">
      <TableChip p={n} />
      <Box aria-hidden sx={{width: 56, height: 56, borderRadius: "16px", background: tint.red[12], color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 30}}}>
        <TimerOffRoundedIcon />
      </Box>
      <Title>Meč je preskočen</Title>
      <Box sx={{fontSize: 16, lineHeight: 1.45, color: color.ink2}}>Prošlo je 10 minuta od početka kola, a igra nije započela i nitko nije odgovorio na upit.</Box>
      <Rows
        rows={[
          {icon: <BlockRoundedIcon />, title: "Meč se ne boduje", text: "Nijedna ekipa ne dobiva bodove za ovo kolo."},
          {icon: <PersonOffRoundedIcon />, tone: "red", title: `${n.teams[0]} i ${n.teams[1]} ispadaju iz turnira`, text: "Ne igraju ostala kola. Odigrana kola ostaju u poretku."},
          ...(n.organizer_phone ? [{icon: <CallRoundedIcon />, title: "Greška?", text: `Javite se organizatoru turnira: ${n.organizer_phone}.`}] : []),
        ]}
      />
      <Box sx={{flex: 1, minHeight: 8}} />
      <PrimaryButton onClick={onClose} sx={{height: 56, fontSize: 16}}>
        Razumijem
      </PrimaryButton>
    </Cover>
  );
}
