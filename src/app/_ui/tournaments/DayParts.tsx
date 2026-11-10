"use client";

import {MyEntry, MyLastTable, TournamentCard, TournamentDetail} from "@/app/_interfaces/tournament";
import {banDay} from "@/app/_lib/bans";
import {telHref, whatsappHref} from "@/app/_lib/phone";
import {NO_SHOW_SKIP_MS} from "@/app/_lib/tournamentDay";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, Card, ConfirmSheet, ErrorNote, PrimaryButton, Spinner} from "@/app/_ui/sp";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import GppMaybeRoundedIcon from "@mui/icons-material/GppMaybeRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LockClockRoundedIcon from "@mui/icons-material/LockClockRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TimerOffRoundedIcon from "@mui/icons-material/TimerOffRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";

// what a table nobody came to is won by, as a Slobodna runda is (5 : 0)
const noShowScore = `${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]}`;

// The tournament's day on the players' pages (Claude Design "Potvrda dolaska" C1–C3 and P1–P9, "Nedolazak za stol"
// N5, N6, N8, "Zabrana prijava" ZP1): Tu smo and what follows it, the organizer's card, a team out of the tournament,
// a table won without play, and a player who may not sign up. Every message is the plural of the team ("Tu smo").

const eyebrowSx = {fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase"} as const;

// "9:43" from an ISO moment, in Zagreb
export const clockOf = (iso: string) => new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(new Date(iso));

// The arrival window's times as the texts say them ("9:30", "10:00")
export function dayTimes(t: Pick<TournamentCard, "day" | "gathering_time" | "start_time">) {
  return {opens: t.day ? clockOf(t.day.opens) : t.gathering_time ?? "", closes: t.day ? clockOf(t.day.closes) : t.start_time ?? ""};
}

// "Potvrdio Marko u 9:43" (or the admin's Označi dolazak)
export function arrivedLine(me: MyEntry): string | null {
  if (!me.arrival) return null;
  const who = me.arrival.admin ? "Organizator je označio dolazak" : `Potvrdio ${me.arrival.by?.split(" ")[0] ?? "igrač"}`;
  return `${who} u ${clockOf(me.arrival.at)}`;
}

// The two players' first names ("Marko · Krešimir")
const firstNames = (me: MyEntry) => me.players.map((p) => p.name.split(" ")[0]).join(" · ");

const navyCard = {flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: shadow.hero} as const;

function Eyebrow({icon, children, tone = color.cream}: {icon: React.ReactNode; children: React.ReactNode; tone?: string}) {
  return (
    <Box component="h2" sx={{m: 0, ...eyebrowSx, color: tone, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
      {icon}
      {children}
    </Box>
  );
}

function TeamName({me}: {me: MyEntry}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
      <Box sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.02, overflowWrap: "anywhere"}}>{me.team_name}</Box>
      <Box component="span" sx={{fontSize: 14, color: color.cream}}>
        {firstNames(me)}
      </Box>
    </Box>
  );
}

const lightButton = {
  ...buttonBase,
  height: 54,
  borderRadius: "16px",
  background: color.white,
  color: color.navy,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: 17,
  fontWeight: 700,
  "& svg": {fontSize: 22},
  "&:disabled": {opacity: 0.45},
} as const;

// Odlazimo and Ipak otkazujemo: a real button, outlined in cream, so the team sees how to leave or cancel
export const leaveButton = {
  ...buttonBase,
  height: 48,
  borderRadius: "14px",
  border: `1.5px solid ${color.cream}`,
  color: color.cream,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: 16,
  fontWeight: 700,
  transition: "background 160ms ease",
  "&:hover": {background: tint.creamOnNavy[16]},
  "& svg": {fontSize: 20},
  "&:disabled": {opacity: 0.45},
} as const;

// Odlazimo under Započni igru on Početna (league and tournament): the cards' outlined cream button on navy, so the
// team playing a table still sees how to leave; it asks first (title, text: what leaving means there)
export function LeaveRow({title, text, onLeave}: {title: string; text: string; onLeave: () => Promise<void>}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLeave();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije spremljeno.");
    }
    setBusy(false);
  };
  return (
    <>
      <Box component="button" type="button" onClick={() => setOpen(true)} sx={{...leaveButton, flex: "none", height: 52, background: color.navy, boxShadow: shadow.card, "&:hover": {background: color.navy}}}>
        <LogoutRoundedIcon aria-hidden />
        Odlazimo
      </Box>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} onConfirm={leave} title={title} text={text} action="Odlazimo" icon={<LogoutRoundedIcon />} busy={busy} error={error} />
    </>
  );
}

// The warning under Tu smo
function FakeWarning() {
  return (
    <Box sx={{display: "flex", gap: "8px", p: "10px 12px", borderRadius: "14px", background: tint.creamOnNavy[16], color: color.cream, fontSize: 13.5, lineHeight: 1.45, "& svg": {fontSize: 18, flex: "none", mt: "1px"}}}>
      <WarningRoundedIcon aria-hidden />
      <span>Potvrdite samo ako ste stvarno tu. Lažna potvrda znači izbacivanje s turnira i privremenu zabranu prijava.</span>
    </Box>
  );
}

export type ArrivalAction = "confirm" | "cancel" | "join" | "leave";

// Once the last Kolo is made a team that doesn't play has no Kolo left to join
const LAST_KOLO_TEXT = "Zadnje kolo je već složeno, pa se više ne može uskočiti.";

// The tournament page's navy card for the team signed up (P2–P9): before the day, the window (Tu smo), confirmed (Ipak
// otkazujemo), after the start without a confirmation (Želimo uskočiti), joined, waiting, and during the tournament
// (Odlazimo). myTable: the Kolo and table being played, when there is one.
export function ArrivalCard({t, busy, error, onAction, myTable}: {t: TournamentDetail; busy: ArrivalAction | null; error: string | null; onAction: (a: ArrivalAction) => void; myTable?: {kolo: number; table: number | null} | null}) {
  const me = t.me!;
  const {opens, closes} = dayTimes(t);
  const phase = t.day?.phase ?? "none";
  const started = t.phase === "active" || phase === "closed";
  const [leaving, setLeaving] = useState(false);
  const waiting = me.status === "WAITING";
  const button = (action: ArrivalAction, label: string, icon: React.ReactNode, disabled = false) => (
    <Box component="button" type="button" disabled={disabled || busy != null} onClick={() => onAction(action)} aria-busy={busy === action || undefined} sx={lightButton}>
      {busy === action ? <Spinner size={20} /> : icon}
      {label}
    </Box>
  );

  // the start time has passed (or Kolo 1 is out)
  if (started) {
    if (waiting) {
      return (
        <Box component="section" aria-label="Na listi čekanja" sx={navyCard}>
          <Eyebrow icon={<HourglassTopRoundedIcon aria-hidden />}>Na listi čekanja · {me.position}.</Eyebrow>
          <TeamName me={me} />
          {me.arrival ? (
            <Box sx={{display: "flex", gap: "8px", fontSize: 14.5, lineHeight: 1.45, color: color.cream, "& svg": {fontSize: 18, flex: "none", mt: "2px"}}}>
              <HourglassTopRoundedIcon aria-hidden />
              <span>Turnir je pun aktivnih ekipa. Ulazite čim se mjesto oslobodi, od sljedećeg kola.</span>
            </Box>
          ) : (
            <>
              <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.cream}}>
                {t.last_kolo_made ? LAST_KOLO_TEXT : "Ako ste stigli, javite se: ulazite čim se mjesto oslobodi, od sljedećeg kola."}
              </Box>
              {!t.last_kolo_made && button("join", "Tu smo · Želimo uskočiti", <LoginRoundedIcon />)}
            </>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
        </Box>
      );
    }
    if (!me.active) {
      return (
        <Box component="section" aria-label="Niste potvrdili dolazak" sx={navyCard}>
          <Eyebrow icon={<PersonOffRoundedIcon aria-hidden />}>{me.arrival ? "Ekipa ne igra" : "Niste potvrdili dolazak"}</Eyebrow>
          <TeamName me={me} />
          <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.cream}}>
            {t.phase === "active" ? "Turnir je počeo bez vas." : "Turnir počinje bez vas."}{" "}
            {t.last_kolo_made ? LAST_KOLO_TEXT : "Ako ste stigli, uskočite: igrate od sljedećeg kola. Propuštena kola se ne broje."}
          </Box>
          {!t.last_kolo_made && button("join", "Tu smo · Želimo uskočiti", <LoginRoundedIcon />)}
          {error && <ErrorNote>{error}</ErrorNote>}
        </Box>
      );
    }
    const playsFrom = me.plays_from;
    return (
      <Box component="section" aria-label="Tu ste" sx={navyCard}>
        <Eyebrow icon={<HowToRegRoundedIcon aria-hidden />}>Tu ste</Eyebrow>
        <TeamName me={me} />
        <Box sx={{display: "flex", gap: "8px", fontSize: 14.5, lineHeight: 1.45, color: color.cream, "& svg": {fontSize: 18, flex: "none", mt: "2px"}}}>
          {playsFrom && playsFrom > 1 ? (
            <>
              <LoginRoundedIcon aria-hidden />
              <span>
                Igrate od Kola {playsFrom}. Stol vidite kad organizator objavi kolo.{" "}
                {playsFrom === 2 ? "Kolo 1 se ne broji." : `Kola 1${playsFrom > 3 ? `–${playsFrom - 1}` : " i 2"} se ne broje.`}
              </span>
            </>
          ) : myTable ? (
            <span>
              Igrate Kolo {myTable.kolo}
              {myTable.table != null && ` · Stol ${myTable.table}`}.
            </span>
          ) : t.phase === "active" ? (
            <span>Sljedeće kolo kreće kad svi stolovi završe. Stol se pojavi ovdje.</span>
          ) : (
            <span>Prvo kolo počinje uskoro. Stol vidite kad ga organizator objavi.</span>
          )}
        </Box>
        {t.phase === "active" && (
          <Box component="button" type="button" onClick={() => setLeaving(true)} disabled={busy != null} sx={leaveButton}>
            <LogoutRoundedIcon aria-hidden />
            Odlazimo
          </Box>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <ConfirmSheet
          open={leaving}
          onClose={() => setLeaving(false)}
          onConfirm={async () => {
            await onAction("leave");
            setLeaving(false);
          }}
          title="Odlazite s turnira?"
          text="Ekipa postaje Neaktivna i ne igra sljedeća kola. Odigrana kola ostaju u poretku."
          action="Odlazimo"
          icon={<LogoutRoundedIcon />}
          busy={busy === "leave"}
          error={null}
        />
      </Box>
    );
  }

  // before the start: confirmed
  if (me.arrival) {
    return (
      <Box component="section" aria-label="Tu ste" sx={navyCard}>
        <Eyebrow icon={<CheckCircleRoundedIcon aria-hidden />}>{waiting ? `Tu ste · lista čekanja ${me.position}.` : "Tu ste"}</Eyebrow>
        <TeamName me={me} />
        <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.cream}}>
          {arrivedLine(me)}.{" "}
          {waiting ? `U ${closes} ulazite ako se oslobodi mjesto.` : `Prvo kolo počinje u ${closes}.`}
        </Box>
        <Box component="button" type="button" onClick={() => onAction("cancel")} disabled={busy != null} sx={leaveButton}>
          {busy === "cancel" ? <Spinner size={18} tone="white" /> : <CloseRoundedIcon aria-hidden />}
          Ipak otkazujemo
        </Box>
        {error && <ErrorNote>{error}</ErrorNote>}
      </Box>
    );
  }

  // the window is open: Tu smo
  if (phase === "open") {
    return (
      <Box component="section" aria-label="Dolazak nije potvrđen" sx={navyCard}>
        <Eyebrow icon={waiting ? <HourglassTopRoundedIcon aria-hidden /> : <RadioButtonUncheckedRoundedIcon aria-hidden />}>
          {waiting ? `Na listi čekanja · ${me.position}.` : "Dolazak nije potvrđen"}
        </Eyebrow>
        <TeamName me={me} />
        <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.cream}}>Jeste li stigli? Potvrdite do {closes}, inače ekipa ne igra prvo kolo.</Box>
        {button("confirm", "Tu smo", <HowToRegRoundedIcon />)}
        <FakeWarning />
        {error && <ErrorNote>{error}</ErrorNote>}
      </Box>
    );
  }

  // days before (or the morning before the gathering)
  return (
    <Box component="section" aria-label={waiting ? "Na listi čekanja" : "Prijavljeni ste"} sx={navyCard}>
      <Eyebrow icon={waiting ? <HourglassTopRoundedIcon aria-hidden /> : <EventAvailableRoundedIcon aria-hidden />}>
        {waiting ? `Na listi čekanja · ${me.position}.` : "Prijavljeni ste"}
      </Eyebrow>
      <TeamName me={me} />
      {phase === "before" ? (
        <Box sx={{display: "flex", gap: "8px", fontSize: 14.5, lineHeight: 1.45, color: color.cream, "& svg": {fontSize: 18, flex: "none", mt: "2px"}}}>
          <ScheduleRoundedIcon aria-hidden />
          <span>
            {waiting
              ? `Ulazite kad se neka ekipa odjavi. Na dan turnira od ${opens} do ${closes} i vi potvrđujete dolazak: prva potvrđena ekipa s liste ulazi umjesto ekipe koja nije potvrdila.`
              : `Na dan turnira od ${opens} do ${closes} ovdje potvrdi da ste došli. Bez potvrde ekipa ne igra prvo kolo.`}
          </span>
        </Box>
      ) : (
        <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.cream}}>{waiting ? "Ulazite kad se neka ekipa odjavi, bez obavijesti. Provjerite ovdje prije turnira." : "Vidimo se na turniru."}</Box>
      )}
    </Box>
  );
}

// Organizator turnira: the number, Nazovi and WhatsApp (the same on every state)
export function OrganizerCard({phone, sx}: {phone: string | null; sx?: SxProps<Theme>}) {
  if (!phone) return null;
  const link = {...buttonBase, flex: 1, height: 46, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: 15, fontWeight: 700, textDecoration: "none", "& svg": {fontSize: 20}} as const;
  return (
    <Card component="section" aria-label="Organizator turnira" sx={{flex: "none", p: "14px 16px", borderRadius: "22px", display: "flex", flexDirection: "column", gap: "12px", ...(sx as object)}}>
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <Box aria-hidden sx={{flex: "none", width: 40, height: 40, borderRadius: "12px", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
          <PersonRoundedIcon />
        </Box>
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
            Organizator turnira
          </Box>
          <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
            {phone}
          </Box>
        </Box>
      </Box>
      <Box sx={{display: "flex", gap: "8px"}}>
        <Box component="a" href={telHref(phone)} sx={{...link, background: color.navy, color: color.white}}>
          <CallRoundedIcon aria-hidden />
          Nazovi
        </Box>
        <Box component="a" href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" sx={{...link, background: color.paper, color: color.navy}}>
          <ChatRoundedIcon aria-hidden />
          WhatsApp
        </Box>
      </Box>
    </Card>
  );
}

// "Ispao": the reason of an exclusion as the players read it
function exclusionLines(t: TournamentDetail): {title: string; lines: {icon: React.ReactNode; text: string}[]} {
  const me = t.me!;
  const x = me.excluded!;
  const last = t.my_last_table;
  const played = (x.kolo ?? 1) - 1;
  const stays = played > 0 ? {icon: <LeaderboardRoundedIcon />, text: played === 1 ? "Kolo 1 ostaje u poretku." : `Kola 1${played > 2 ? `–${played}` : " i 2"} ostaju u poretku.`} : null;
  const ban = x.kolo === 1 && x.reason !== "ADMIN";
  if (x.reason === "NO_SHOW" && last && last.attendance === "NO_SHOW" && !last.won) {
    return {
      title: `${last.opponent} su u ${clockOf(last.at)} prijavili da niste došli za Stol ${last.table_number ?? ""} u Kolu ${last.kolo}.`,
      lines: [
        {icon: <EmojiEventsRoundedIcon />, text: `${last.opponent} su dobili ${noShowScore}${last.matches.length > 1 ? " po partiji" : ""}.`},
        {icon: <BlockRoundedIcon />, text: `Ne igrate ostala kola ovog turnira. ${ban ? "Dobili ste i zabranu prijava na turnire na mjesec dana." : "Zabrane prijava nema."}`},
        ...(stays ? [stays] : []),
      ],
    };
  }
  if (x.reason === "SKIPPED") {
    return {
      title: `Meč za ${last?.table_number != null ? `Stolom ${last.table_number}` : "vašim stolom"} u Kolu ${x.kolo} nije započeo ni ${NO_SHOW_SKIP_MS / 60_000} minuta nakon početka kola i nitko nije prijavio nedolazak.`,
      lines: [
        {icon: <BlockRoundedIcon />, text: `Meč se ne boduje. Ne igrate ostala kola.${ban ? " Dobili ste i zabranu prijava na turnire na mjesec dana." : ""}`},
        ...(stays ? [stays] : []),
        {icon: <GppMaybeRoundedIcon />, text: "Ako je greška, organizator vas može vratiti u turnir."},
      ],
    };
  }
  return {
    title: `Organizator je isključio ekipu ${me.team_name} nakon Kola ${x.kolo ?? 1}.`,
    lines: [{icon: <BlockRoundedIcon />, text: "Ne igrate ostala kola ovog turnira."}, ...(stays ? [stays] : []), {icon: <GppMaybeRoundedIcon />, text: "Ako je greška, organizator vas može vratiti u turnir."}],
  };
}

// Isključeni ste iz turnira (N6, N8)
export function ExcludedCard({t}: {t: TournamentDetail}) {
  const {title, lines} = exclusionLines(t);
  return (
    <Card component="section" aria-label="Isključeni ste iz turnira" sx={{flex: "none", p: "18px", borderRadius: "22px", display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box aria-hidden sx={{width: 52, height: 52, borderRadius: "15px", background: tint.red[12], color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}>
        <PersonOffRoundedIcon />
      </Box>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.1}}>
        Isključeni ste iz turnira
      </Box>
      <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.ink2}}>{title}</Box>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
        {lines.map((l) => (
          <Box component="li" key={l.text} sx={{display: "flex", gap: "10px", fontSize: 14.5, lineHeight: 1.4, "& svg": {fontSize: 20, color: color.ink2, flex: "none"}}}>
            {l.icon}
            <span>{l.text}</span>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// Pobjeda bez igre (N5): the table won as a Slobodna runda is (NO_SHOW_SCORE) because the opponent didn't come
export function NoShowWinCard({last, kolo}: {last: MyLastTable; kolo: number | null}) {
  return (
    <Box component="section" aria-label="Pobjeda bez igre" sx={navyCard}>
      <Eyebrow icon={<EmojiEventsRoundedIcon aria-hidden />}>Pobjeda bez igre{last.table_number != null && ` · Stol ${last.table_number}`}</Eyebrow>
      <Box sx={{fontSize: 16, lineHeight: 1.45}}>
        {last.opponent} nisu došli. Dobivate {noShowScore}{last.matches.length > 1 ? " po partiji" : ""}.
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        {last.matches.map((m, i) => (
          <Box key={i} sx={{display: "flex", alignItems: "center", justifyContent: "space-between", p: "10px 12px", borderRadius: "12px", background: tint.creamOnNavy[16], fontSize: 15}}>
            <span>{last.matches.length > 1 ? `${i + 1}. partija` : "Partija"}</span>
            <Box component="strong" sx={{fontFamily: font.display, fontSize: 18, fontWeight: 800}}>
              {m[0]} : {m[1]}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{display: "flex", gap: "8px", fontSize: 14, lineHeight: 1.45, color: color.cream, "& svg": {fontSize: 18, flex: "none", mt: "1px"}}}>
        <HourglassTopRoundedIcon aria-hidden />
        <span>{kolo ? `Čekate Kolo ${kolo}. Počinje kad svi stolovi završe.` : "Čekate sljedeće kolo. Počinje kad svi stolovi završe."}</span>
      </Box>
    </Box>
  );
}

// Zabrana prijava on the page of a tournament the player may not sign up for (ZP1): Prijava nije moguća, why until
// when, and who to ask
export function BannedSignUp({until}: {until: string | null}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
      <Box component="button" type="button" disabled sx={{...lightButton, background: tint.white[25], color: color.white, "&:disabled": {opacity: 1}}}>
        <BlockRoundedIcon aria-hidden />
        Prijava nije moguća
      </Box>
      <Box sx={{display: "flex", gap: "8px", fontSize: 14, lineHeight: 1.45, color: color.cream, "& svg": {fontSize: 18, flex: "none", mt: "1px"}}}>
        <BlockRoundedIcon aria-hidden />
        <span>
          {until
            ? `Prijave su vam zabranjene do ${banDay(until)}. Do tada se ne možete prijaviti ni s jednom ekipom.`
            : "Prijave su vam zabranjene. Ne možete se prijaviti ni s jednom ekipom."}{" "}
          Za pitanja se javite organizatoru.
        </span>
      </Box>
    </Box>
  );
}

// Right after signing up (P1): what happens on the day, in three steps
export function JoinedSheet({open, onClose, t, team}: {open: boolean; onClose: () => void; t: TournamentDetail; team: string}) {
  const {opens, closes} = dayTimes(t);
  const steps = [
    {
      title: `Od ${opens} potvrdi dolazak`,
      text: (
        <>
          Na stranici turnira klikni „Tu smo”.{" "}
          <Box component="strong" sx={{fontWeight: 700}}>
            Dovoljno je da potvrdi jedan od vas.
          </Box>
        </>
      ),
    },
    {title: `Bez potvrde do ${closes} ne igrate 1. kolo`, text: "Ako stignete kasnije, uskočite od sljedećeg kola."},
    {title: "Kasnite? Javite se organizatoru", text: "Broj organizatora je na stranici turnira (Nazovi · WhatsApp)."},
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title={`${team} su prijavljeni`} closable>
      <Box sx={{display: "flex", flexDirection: "column", gap: "12px"}}>
        <Box sx={{fontSize: 15, color: color.ink2}}>{t.name}</Box>
        <Box sx={{...eyebrowSx, color: color.muted}}>Na dan turnira</Box>
        <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "12px"}}>
          {steps.map((s, i) => (
            <Box component="li" key={s.title} sx={{display: "flex", gap: "12px"}}>
              <Box aria-hidden sx={{flex: "none", width: 30, height: 30, borderRadius: "50%", background: color.navy, color: color.white, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center"}}>
                {i + 1}
              </Box>
              <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <Box component="span" sx={{fontSize: 15.5, fontWeight: 700}}>
                  {s.title}
                </Box>
                <Box component="span" sx={{fontSize: 14, lineHeight: 1.4, color: color.ink2}}>
                  {s.text}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
        <PrimaryButton onClick={onClose} icon={<ChevronRightRoundedIcon />} sx={{height: 54, fontSize: 16, flexDirection: "row-reverse"}}>
          Na stranicu turnira
        </PrimaryButton>
      </Box>
    </BottomSheet>
  );
}

// On Početna's main card (C1–C3): Potvrda dolaska under the tournament, with its own buttons
export function HomeArrival({t, busy, onAction}: {t: TournamentCard; busy: ArrivalAction | null; onAction: (a: ArrivalAction) => void}) {
  const me = t.me;
  if (!me || !t.day || me.excluded) return null;
  const {opens, closes} = dayTimes(t);
  const phase = t.day.phase;
  const box = {display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "18px", background: tint.creamOnNavy[16]} as const;
  const head = (icon: React.ReactNode, title: string) => (
    <Box sx={{display: "flex", alignItems: "center", gap: "6px", ...eyebrowSx, color: color.cream, "& svg": {fontSize: 18}}}>
      {icon}
      {title}
    </Box>
  );
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const tuSmo = (disabled: boolean, label = "Tu smo", action: ArrivalAction = "confirm") => (
    <Box
      component="button"
      type="button"
      disabled={disabled || busy != null}
      onClick={(e: React.MouseEvent) => {
        stop(e);
        onAction(action);
      }}
      sx={{...lightButton, height: 50, fontSize: 16, ...(disabled && {"&:disabled": {opacity: 0.5}})}}
    >
      {busy === action ? <Spinner size={18} /> : <HowToRegRoundedIcon aria-hidden />}
      {label}
    </Box>
  );
  if (phase === "closed") {
    if (me.status === "REGISTERED" && me.active) return null;
    return (
      <Box sx={box} onClick={stop}>
        {head(<PersonOffRoundedIcon aria-hidden />, me.status === "WAITING" ? `Lista čekanja · ${me.position}.` : "Niste potvrdili dolazak")}
        <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>{t.last_kolo_made ? LAST_KOLO_TEXT : "Ako ste stigli, uskočite: igrate od sljedećeg kola."}</Box>
        {!t.last_kolo_made && !(me.status === "WAITING" && me.arrival) && tuSmo(false, "Tu smo · Želimo uskočiti", "join")}
      </Box>
    );
  }
  if (me.arrival) {
    return (
      <Box sx={box} onClick={stop}>
        {head(<CheckCircleRoundedIcon aria-hidden />, "Tu ste")}
        <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>
          Dolazak je potvrđen. {me.status === "WAITING" ? `U ${closes} ulazite ako se oslobodi mjesto.` : `Prvo kolo počinje u ${closes}.`}
          <br />
          {arrivedLine(me)}
        </Box>
        <Box
          component="button"
          type="button"
          disabled={busy != null}
          onClick={(e: React.MouseEvent) => {
            stop(e);
            onAction("cancel");
          }}
          sx={leaveButton}
        >
          <CloseRoundedIcon aria-hidden />
          Ipak otkazujemo
        </Box>
      </Box>
    );
  }
  if (phase === "open") {
    return (
      <Box sx={box} onClick={stop}>
        {head(<RadioButtonUncheckedRoundedIcon aria-hidden />, `Potvrdite dolazak do ${closes}`)}
        <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>
          Jeste li stigli? Bez potvrde do {closes} ekipa ne igra prvo kolo. Lažna potvrda znači izbacivanje s turnira i privremenu zabranu prijava.
        </Box>
        {tuSmo(false)}
      </Box>
    );
  }
  return (
    <Box sx={box} onClick={stop}>
      {head(<LockClockRoundedIcon aria-hidden />, "Potvrda dolaska")}
      <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>
        Na dan turnira od {opens} kad stignete,{" "}
        <Box component="strong" sx={{fontWeight: 700}}>
          {`jedan igrač stisne "Tu smo"`}
        </Box>{" "}
        i ekipa ulazi u raspored.
      </Box>
      {tuSmo(true)}
    </Box>
  );
}

// A skipped table's mark in a list ("Preskočen")
export function SkippedMark() {
  return (
    <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: "4px", fontSize: 13, fontWeight: 700, color: color.red, "& svg": {fontSize: 16}}}>
      <TimerOffRoundedIcon aria-hidden />
      Preskočen
    </Box>
  );
}
