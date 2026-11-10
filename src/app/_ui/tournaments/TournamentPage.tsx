"use client";

import {arrivalAPI, signOffAPI} from "@/app/_fetchers/tournament";
import useNavStack from "@/app/_hooks/useNavStack";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {useTournament, useTournaments} from "@/app/_hooks/useTournaments";
import {leagueDateString} from "@/app/_lib/dates";
import {isComingUp} from "@/app/_lib/tournaments";
import useAuthStore from "@/app/_store/authStore";
import {color, font, shadow} from "@/app/_styles/tokens";
import {StartCard} from "@/app/_ui/home/StartCard";
import {buttonBase, Card, ConfirmSheet, EmptyState, ErrorNote, LoadingRows, StackTopBar} from "@/app/_ui/sp";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useEffect, useState} from "react";
import PlayerFrame from "./PlayerFrame";
import {EntriesPreview, InfoCard, MyMatchesCard, MyResultCard, PrizesCard, ResultsButton, SignUpCard, TournamentHead, UpcomingCard, WinnersCard} from "./PlayerParts";
import SignUpSheet from "./SignUpSheet";
import {ArrivalAction, ArrivalCard, ExcludedCard, JoinedSheet, NoShowWinCard, OrganizerCard} from "./DayParts";

// A tournament's page (Claude Design "Natjecanja" R1–R5, D1–D2, W1, G0; "Potvrda dolaska" P1–P9; "Nedolazak za stol"
// N5, N6, N8; "Zabrana prijava" ZP1). Before it starts: the navy card of the sign-ups (Prijavi se, or the team signed
// up or waiting, with Tu smo on the day), the organizer, the details, the prizes and the teams signed up. On the day:
// the player's table (Nastavi igru / Započni igru), a table won without play, the team out of the tournament, joining
// (Želimo uskočiti) and leaving (Odlazimo), and Poredak i rezultati. Once it is over: Pobjednici, the results, and for
// a player who played Vaš rezultat and Vaši mečevi. Public: a visitor sees it read-only.
// ?prijava=1 (a visitor's Prijavi se, back from logging in) opens the sign-up sheet at once.
export default function TournamentPage({id}: {id: number}) {
  const meId = useAuthStore((s) => s.user?.id ?? null);
  const signedIn = meId != null;
  const [every, setEvery] = useState<number | undefined>(undefined);
  const {tournament: t, error, notFound, reload} = useTournament(id, every);
  const nav = useNavStack(t ? t.name : null, "/turniri");
  const params = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [arrivalBusy, setArrivalBusy] = useState<ArrivalAction | null>(null);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const {table: openTable} = useOpenTable("tournament");
  const game = useStartGame({scope: "tournament"});
  const {tournaments} = useTournaments();
  const today = leagueDateString();

  // a tournament being played comes in again every 30 s, and on its day every 20 s (the arrival window)
  const live = t?.phase === "active" || (t?.day != null && t.day.phase !== "before" && t.phase === "upcoming");
  if ((live ? 20_000 : undefined) !== every) setEvery(live ? 20_000 : undefined);
  useEffect(() => {
    if (t && params.get("prijava") === "1" && signedIn && t.signups_open_now && !t.me) setSheet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);

  const arrival = async (action: ArrivalAction) => {
    if (!t || arrivalBusy) return;
    setArrivalBusy(action);
    setArrivalError(null);
    try {
      await arrivalAPI(t.id, action);
      reload();
    } catch (e) {
      setArrivalError(e instanceof Error ? e.message : "Nije spremljeno.");
    }
    setArrivalBusy(null);
  };

  const signOff = async () => {
    if (!t?.me) return;
    setBusy(true);
    setWithdrawError(null);
    try {
      await signOffAPI(t.id, t.me.team_id);
      setWithdraw(false);
      reload();
    } catch (e) {
      setWithdrawError(e instanceof Error ? e.message : "Ekipa nije odjavljena.");
    }
    setBusy(false);
  };

  const others = (tournaments ?? []).filter((x) => isComingUp(x, leagueDateString()) && x.id !== id).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const myTable = openTable && openTable.tournamentId === id ? openTable : null;
  // the day has started (the start time or Kolo 1): no more signing off
  const dayClosed = t?.day?.phase === "closed";
  // a table of the Kolo being played won without play (Pobjeda bez igre)
  const wonWithoutPlay = t?.my_last_table && t.my_last_table.won && t.my_last_table.kolo === t.live_kolo ? t.my_last_table : null;

  return (
    <PlayerFrame>
      <StackTopBar eyebrow="Turnir" nav={nav} />
      {notFound ? (
        <Card>
          <EmptyState>Ovaj turnir ne postoji.</EmptyState>
        </Card>
      ) : error && !t ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !t ? (
        <Card>
          <LoadingRows rows={6} height={56} />
        </Card>
      ) : (
        <>
          <TournamentHead t={t} today={today} />
          {t.phase === "upcoming" && (
            <>
              {t.me ? (
                <ArrivalCard t={t} busy={arrivalBusy} error={arrivalError} onAction={arrival} />
              ) : (
                <SignUpCard t={t} meId={meId} signedIn={signedIn} onSignUp={() => setSheet(true)} />
              )}
              {(t.me || t.my_ban) && <OrganizerCard phone={t.organizer_phone} />}
              <InfoCard t={t} hidePlace={t.me?.status === "REGISTERED"} />
              <PrizesCard prizes={t.prizes} startsOpen={t.me != null} />
              <EntriesPreview t={t} meId={meId} />
              {t.me && !dayClosed && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setWithdraw(true)}
                  sx={{...buttonBase, alignSelf: "center", height: 48, display: "flex", alignItems: "center", gap: "8px", px: "16px", borderRadius: "14px", color: color.red, fontSize: 15, fontWeight: 700, "& svg": {fontSize: 20}}}
                >
                  <LogoutRoundedIcon aria-hidden />
                  {t.me.status === "WAITING" ? "Makni se s liste čekanja" : "Odjavi se s turnira"}
                </Box>
              )}
            </>
          )}
          {t.phase === "active" && (
            <>
              {t.me?.excluded ? (
                <ExcludedCard t={t} />
              ) : myTable ? (
                <StartCard table={myTable} starting={game.starting} onStart={game.start} />
              ) : wonWithoutPlay ? (
                <NoShowWinCard last={wonWithoutPlay} kolo={(t.live_kolo ?? 0) + 1 <= t.rounds ? (t.live_kolo ?? 0) + 1 : null} />
              ) : t.me && (t.me.status === "WAITING" || !t.me.active || t.me.plays_from) ? (
                <ArrivalCard t={t} busy={arrivalBusy} error={arrivalError} onAction={arrival} />
              ) : !t.me && t.signups_open_now ? (
                // Otvorene prijave: a team can still come in while the tournament is played (DECISIONS #88)
                <SignUpCard t={t} meId={meId} signedIn={signedIn} onSignUp={() => setSheet(true)} />
              ) : (
                t.me?.status === "REGISTERED" && <WaitingCard team={t.me.team_name} kolo={t.live_kolo} onLeave={() => arrival("leave")} leaving={arrivalBusy === "leave"} />
              )}
              {game.error && <ErrorNote>{game.error}</ErrorNote>}
              <ResultsButton t={t} />
              {t.me && <OrganizerCard phone={t.organizer_phone} />}
            </>
          )}
          {t.phase === "finished" && (
            <>
              {t.winner && <WinnersCard winner={t.winner} />}
              <ResultsButton t={t} />
              {t.my_result && <MyResultCard r={t.my_result} />}
              <MyMatchesCard matches={t.my_matches} tournamentId={t.id} />
            </>
          )}
          {t.phase === "cancelled" && (
            <>
              <Card sx={{p: "16px 18px", fontSize: 15, lineHeight: 1.5}}>Turnir je otkazan. Prijave su zatvorene i turnir se neće igrati.</Card>
              <InfoCard t={t} />
            </>
          )}
          {t.phase !== "upcoming" && others.length > 0 && (
            <Box component="section" aria-label="Nadolazeći turniri" sx={{display: "flex", flexDirection: "column", gap: "8px", pt: "6px"}}>
              <Box component="h2" sx={{m: 0, px: "4px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
                Nadolazeći turniri
              </Box>
              <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
                {others.map((o) => (
                  <UpcomingCard key={o.id} t={o} />
                ))}
              </Box>
            </Box>
          )}
          {signedIn && t.phase === "upcoming" && (
            <SignUpSheet
              t={t}
              open={sheet}
              onClose={() => setSheet(false)}
              onDone={(_status, team) => {
                setSheet(false);
                if (t.day && team) setJoined(team);
                reload();
              }}
            />
          )}
          {joined && <JoinedSheet open={joined != null} onClose={() => setJoined(null)} t={t} team={joined} />}
          {t.me && (
            <ConfirmSheet
              open={withdraw}
              onClose={() => setWithdraw(false)}
              onConfirm={signOff}
              title={t.me.status === "WAITING" ? `Maknuti ekipu ${t.me.team_name} s liste čekanja?` : `Odjaviti ekipu ${t.me.team_name} s turnira?`}
              text="Ekipa više neće biti na popisu prijavljenih. Možeš se ponovo prijaviti dok su prijave otvorene."
              action="Odjavi ekipu"
              icon={<LogoutRoundedIcon />}
              busy={busy}
              error={withdrawError}
            />
          )}
        </>
      )}
    </PlayerFrame>
  );
}

// On the day, between the player's tables: their team and the Kolo being played, and Odlazimo (asked first)
function WaitingCard({team, kolo, onLeave, leaving}: {team: string; kolo: number | null; onLeave: () => void; leaving: boolean}) {
  const [asking, setAsking] = useState(false);
  return (
    <Box component="section" aria-label="Tvoja ekipa" sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: shadow.hero}}>
      <Box component="h2" sx={{m: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream}}>
        Tvoja ekipa
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, overflowWrap: "anywhere"}}>{team}</Box>
      <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.cream}}>
        {kolo ? `Vaš stol u Kolu ${kolo} je odigran. Sljedeće kolo kreće kad svi stolovi završe.` : "Sljedeće kolo uskoro: stol će se pojaviti ovdje."}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => setAsking(true)}
        sx={{...buttonBase, alignSelf: "center", height: 44, px: "14px", borderRadius: "12px", color: color.cream, fontSize: 15, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px"}}
      >
        Odlazimo
      </Box>
      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={async () => {
          await onLeave();
          setAsking(false);
        }}
        title="Odlazite s turnira?"
        text="Ekipa postaje Neaktivna i ne igra sljedeća kola. Odigrana kola ostaju u poretku."
        action="Odlazimo"
        icon={<LogoutRoundedIcon />}
        busy={leaving}
        error={null}
      />
    </Box>
  );
}
