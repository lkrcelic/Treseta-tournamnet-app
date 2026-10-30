"use client";

import {leagueArrivalAPI} from "@/app/_fetchers/league/arrival";
import {MyLeagueArrival} from "@/app/_interfaces/leagueArrival";
import {LeagueArrivalAction, leagueArrivalPhase} from "@/app/_lib/leagueArrival";
import {leagueClock} from "@/app/_lib/dates";
import {color, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet, Spinner} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import LockClockRoundedIcon from "@mui/icons-material/LockClockRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// Potvrda dolaska on Početna · Večeras (DECISIONS #73), the tournament's block (Claude Design "Potvrda dolaska" C1–C3)
// in the league's navy card: before the window the button waits; then Tu smo; a team that is here sees who confirmed
// and Ipak otkazujemo (Odlazimo once the night has started); one that left or never came can still jump in for the next
// kolo. Every message is the plural of the team ("Tu smo").

const eyebrowSx = {fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase"} as const;

const lightButton = {
  ...buttonBase,
  height: 50,
  borderRadius: "16px",
  background: color.white,
  color: color.navy,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: 16,
  fontWeight: 700,
  "& svg": {fontSize: 22},
  "&:disabled": {opacity: 0.45},
} as const;

const quietButton = {...buttonBase, alignSelf: "flex-start", height: 36, color: color.cream, fontSize: 15, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px"} as const;

// "Potvrdio Marko u 19:42", or the admin's switch in Novo kolo
function arrivedLine(a: NonNullable<MyLeagueArrival["arrival"]>): string {
  const who = a.by_admin ? "Organizator je označio dolazak" : `Potvrdio ${a.by?.split(" ")[0] ?? "igrač"}`;
  return `${who} u ${clockOf(a.arrived_at)}`;
}

// "19:42": an ISO moment's time in Zagreb (Bela takes it from its tournaments' DayParts)
const clockOf = (iso: string) => leagueClock(new Date(iso));

// The time now, again every 20 s, so the window opens and the night starts on screen by themselves
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function LeagueArrival({leagueId, teamId, initial, onChanged}: {leagueId: number; teamId: number; initial: MyLeagueArrival; onChanged?: () => void}) {
  const [card, setCard] = useState(initial);
  const [busy, setBusy] = useState<LeagueArrivalAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const now = useNow();
  // a fresh schedule (another phone of the team pressed it) replaces what this one showed
  useEffect(() => setCard(initial), [initial]);

  const phase = leagueArrivalPhase(card, now);
  if (phase === "over") return null;
  const opens = clockOf(card.opens);
  const start = clockOf(card.start);
  const here = card.arrival?.here ?? false;

  const act = async (action: LeagueArrivalAction) => {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      setCard(await leagueArrivalAPI(leagueId, teamId, action));
      setLeaving(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije spremljeno.");
    } finally {
      setBusy(null);
    }
  };

  const box = {display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "18px", background: tint.creamOnNavy[16]} as const;
  const head = (icon: React.ReactNode, title: string) => (
    <Box component="h3" sx={{m: 0, display: "flex", alignItems: "center", gap: "6px", ...eyebrowSx, color: color.cream, "& svg": {fontSize: 18}}}>
      {icon}
      {title}
    </Box>
  );
  const line = (text: React.ReactNode) => <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>{text}</Box>;
  const tuSmo = (label: string, disabled = false) => (
    <Box component="button" type="button" disabled={disabled || busy != null} onClick={() => act("confirm")} sx={lightButton}>
      {busy === "confirm" ? <Spinner size={18} /> : <HowToRegRoundedIcon aria-hidden />}
      {label}
    </Box>
  );
  const errorLine = error && (
    <Box role="alert" sx={{fontSize: 14, lineHeight: 1.45, fontWeight: 600, color: color.white}}>
      {error}
    </Box>
  );

  if (here) {
    return (
      <Box component="section" aria-label="Potvrda dolaska" sx={box}>
        {head(<CheckCircleRoundedIcon aria-hidden />, "Tu ste")}
        {line(
          <>
            Dolazak je potvrđen. {phase === "started" ? "Igrate u idućem kolu." : `Večer počinje u ${start}.`}
            <br />
            {arrivedLine(card.arrival!)}
          </>
        )}
        {phase === "started" ? (
          <Box component="button" type="button" disabled={busy != null} onClick={() => setLeaving(true)} sx={quietButton}>
            Odlazimo
          </Box>
        ) : (
          <Box component="button" type="button" disabled={busy != null} onClick={() => act("leave")} sx={quietButton}>
            {busy === "leave" ? <Spinner size={18} tone="white" /> : "Ipak otkazujemo"}
          </Box>
        )}
        {errorLine}
        <ConfirmSheet
          open={leaving}
          onClose={() => setLeaving(false)}
          onConfirm={() => act("leave")}
          title="Odlazite?"
          text="Ekipa ne ulazi u iduće novo kolo. Kola koja su već objavljena ostaju kakva jesu."
          action="Odlazimo"
          icon={<LogoutRoundedIcon />}
          busy={busy === "leave"}
          error={null}
        />
      </Box>
    );
  }

  if (phase === "started") {
    const left = card.arrival?.left_at ?? null;
    return (
      <Box component="section" aria-label="Potvrda dolaska" sx={box}>
        {head(<PersonOffRoundedIcon aria-hidden />, left ? "Otišli ste" : "Niste potvrdili dolazak")}
        {line(
          left && card.arrival?.left_by_admin
            ? `Organizator vas je u ${clockOf(left)} maknuo iz idućeg kola. Ako ste tu, uskočite.`
            : "Ako ste tu, uskočite: igrate od idućeg kola."
        )}
        {tuSmo("Tu smo · Želimo uskočiti")}
        {errorLine}
      </Box>
    );
  }

  if (phase === "open") {
    return (
      <Box component="section" aria-label="Potvrda dolaska" sx={box}>
        {head(<RadioButtonUncheckedRoundedIcon aria-hidden />, `Potvrdite dolazak do ${start}`)}
        {line("Jeste li stigli? U kolo ulaze samo ekipe koje su potvrdile dolazak. Dovoljno je da potvrdi jedan od vas.")}
        {tuSmo("Tu smo")}
        {errorLine}
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Potvrda dolaska" sx={box}>
      {head(<LockClockRoundedIcon aria-hidden />, "Potvrda dolaska")}
      {line(`Gumb se otvara u ${opens}. Kad stignete, potvrdite dolazak (Tu smo): u kolo ulaze samo ekipe koje su tu.`)}
      {tuSmo("Tu smo", true)}
    </Box>
  );
}
