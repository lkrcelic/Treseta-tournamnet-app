"use client";

import {arrivalAPI} from "@/app/_fetchers/tournament";
import useBurza from "@/app/_hooks/useBurza";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {useTournaments} from "@/app/_hooks/useTournaments";
import {TournamentCard} from "@/app/_interfaces/tournament";
import {leagueDateString} from "@/app/_lib/dates";
import {isComingUp} from "@/app/_lib/tournaments";
import {color} from "@/app/_styles/tokens";
import {BurzaHomeCard, NextNightPlaceholder} from "@/app/_ui/home/HomeCards";
import {StartCard} from "@/app/_ui/home/StartCard";
import {ErrorNote} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React, {useState} from "react";
import {ArrivalAction, LeaveRow} from "./DayParts";
import {FinishedRow, NextTournamentCard, NoTournamentCard, ResultsButton, TodayCard, UpcomingCard} from "./PlayerParts";

// Početna · Turniri (Claude Design "Natjecanja" S2–S4), also /turniri on its own: the card on top (the player's table
// on the day, else the next tournament: the one they signed up for when two are on the same day), Burza igrača,
// Nadolazeći turniri with Prijavi se, and Završeni turniri.

// The tournament the card on top shows: one being played that the viewer is in, else the soonest coming up (the
// viewer's first on the same day; one whose day passed without starting is left out, isComingUp)
export function mainTournament(list: TournamentCard[], today: string = leagueDateString()): TournamentCard | null {
  const live = list.filter((t) => t.phase === "active" && t.me?.status === "REGISTERED");
  if (live.length) return live[0];
  const coming = list.filter((t) => isComingUp(t, today)).sort((a, b) => a.date.localeCompare(b.date) || Number(!!b.me) - Number(!!a.me));
  return coming[0] ?? null;
}

// a tournament is live and the viewer plays in it (the red dot on Početna's Turniri tab)
export const playingToday = (list: TournamentCard[] | null) => (list ?? []).some((t) => t.phase === "active" && t.me?.status === "REGISTERED");

export default function TournamentsOverview({withBurza = false}: {withBurza?: boolean}) {
  const {tournaments, error, reload} = useTournaments(30_000);
  const {table: openTable, loading: tableLoading} = useOpenTable("tournament");
  const game = useStartGame({scope: "tournament"});
  const {posts} = useBurza();
  const list = tournaments ?? [];
  const main = mainTournament(list);
  const upcoming = list.filter((t) => isComingUp(t, leagueDateString()) && t.id !== main?.id).sort((a, b) => a.date.localeCompare(b.date));
  const finished = list.filter((t) => t.phase === "finished").sort((a, b) => b.date.localeCompare(a.date));
  const liveOfTable = openTable ? list.find((t) => t.id === openTable.tournamentId) : undefined;
  // Tu smo and Ipak otkazujemo on the card itself (Potvrda dolaska C2, C3)
  const [arrivalBusy, setArrivalBusy] = useState<ArrivalAction | null>(null);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const onArrival = async (action: ArrivalAction) => {
    if (!main || arrivalBusy) return;
    setArrivalBusy(action);
    setArrivalError(null);
    try {
      await arrivalAPI(main.id, action);
      reload();
    } catch (e) {
      setArrivalError(e instanceof Error ? e.message : "Nije spremljeno.");
    }
    setArrivalBusy(null);
  };

  return (
    <>
      {openTable ? (
        <>
          <StartCard table={openTable} starting={game.starting} onStart={game.start} />
          {liveOfTable && <ResultsButton t={liveOfTable} />}
          {liveOfTable?.phase === "active" && liveOfTable.me?.status === "REGISTERED" && (
            <LeaveRow
              title="Odlazite s turnira?"
              text="Ekipa postaje Neaktivna i ne igra sljedeća kola. Odigrana kola ostaju u poretku."
              onLeave={async () => {
                await arrivalAPI(liveOfTable.id, "leave");
                reload();
              }}
            />
          )}
        </>
      ) : (tableLoading || !tournaments) && !error ? (
        <Box sx={{flex: "none", borderRadius: "24px", viewTransitionName: "table"}}>
          <NextNightPlaceholder />
        </Box>
      ) : main?.phase === "active" ? (
        <>
          <TodayCard t={main} />
          <ResultsButton t={main} />
        </>
      ) : main ? (
        <NextTournamentCard t={main} arrival={{busy: arrivalBusy, onAction: onArrival}} />
      ) : (
        <NoTournamentCard />
      )}
      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}
      {arrivalError && <ErrorNote>{arrivalError}</ErrorNote>}
      {game.error && <ErrorNote>{game.error}</ErrorNote>}
      {withBurza && <BurzaHomeCard posts={posts} />}
      {upcoming.length > 0 && (
        <Box component="section" aria-label="Nadolazeći turniri" sx={{display: "flex", flexDirection: "column", gap: "8px", pt: "4px"}}>
          <Box component="h2" sx={{m: 0, px: "4px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
            Nadolazeći turniri
          </Box>
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
            {upcoming.map((t) => (
              <UpcomingCard key={t.id} t={t} />
            ))}
          </Box>
        </Box>
      )}
      <FinishedRow finished={finished} />
    </>
  );
}
