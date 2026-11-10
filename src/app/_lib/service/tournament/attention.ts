import {prisma} from "@/app/_lib/prisma";
import {Viewer} from "@/app/_lib/players/privacy";

import {teamLabel} from "@/app/_lib/bye";
import {noShowStep, noShowTimes, tournamentDays} from "@/app/_lib/tournamentDay";
import {awaitingPlay} from "./attendance";
import {syncTournament} from "./clock";

// What a player's app checks on every screen on a tournament day: the question about their table (Jesu li … za
// stolom?, which nothing can close until someone answers) and a skipped match's notice (Meč je preskočen, shown once).
// Only the players of the table's two teams get them, never an admin as such. poll_in tells the app when to ask again:
// soon while a table waits for play, rarely on a day without a tournament.

export type AttentionPrompt = {
  round_id: number;
  tournament_id: number;
  tournament_name: string;
  kolo: number;
  table_number: number | null;
  my_team: string;
  opponent: string;
  matches_per_round: number;
  // ISO times: the Kolo went out, the question, the answers unlocked, the skip
  published_at: string;
  ask_at: string;
  unlock_at: string;
  skip_at: string;
};

export type AttentionNotice = {
  kind: "skipped";
  round_id: number;
  tournament_id: number;
  kolo: number;
  table_number: number | null;
  teams: [string, string];
  organizer_phone: string | null;
};

export type Attention = {now: string; prompt: AttentionPrompt | null; notices: AttentionNotice[]; poll_in: number};

const QUIET_S = 600;
const DAY_S = 30;
const FAST_S = 5;

export async function attentionFor(viewer: Viewer): Promise<Attention> {
  const now = new Date();
  const today = tournamentDays(now);
  const teams = await prisma.teamPlayer.findMany({where: {player_id: viewer.id}, select: {team_id: true}});
  const teamIds = teams.map((t) => t.team_id);
  const quiet: Attention = {now: now.toISOString(), prompt: null, notices: [], poll_in: QUIET_S};
  if (teamIds.length === 0) return quiet;

  const tournaments = await prisma.tournament.findMany({
    where: {date: {in: today}, cancelled_at: null, tournamentTeams: {some: {team_id: {in: teamIds}}}},
    select: {tournament_id: true, tournament_name: true, organizer_phone: true},
  });
  if (tournaments.length === 0) return quiet;
  for (const t of tournaments) await syncTournament(t.tournament_id);

  const tables = await prisma.round.findMany({
    where: {
      tournamentRounds: {some: {tournament_id: {in: tournaments.map((t) => t.tournament_id)}}},
      status: "PUBLISHED",
      round_date: {in: today},
      OR: [{team1_id: {in: teamIds}}, {team2_id: {in: teamIds}}],
    },
    orderBy: [{round_number: "desc"}, {id: "desc"}],
    select: {
      id: true,
      round_number: true,
      round_date: true,
      table_number: true,
      team1_id: true,
      team2_id: true,
      open: true,
      status: true,
      published_at: true,
      attendance: true,
      matches_per_round: true,
      team1: {select: {team_name: true}},
      team2: {select: {team_name: true}},
      tournamentRounds: {select: {tournament_id: true}, take: 1},
      _count: {select: {matches: true, ongoingMatches: true}},
    },
  });

  let prompt: AttentionPrompt | null = null;
  let pollIn = DAY_S;
  for (const t of tables) {
    if (!awaitingPlay(t, today)) continue;
    const times = noShowTimes(t.published_at!);
    const step = noShowStep(t.published_at!, now);
    const mine = teamIds.includes(t.team1_id) ? 1 : 2;
    if (step === "waiting") {
      // ask again when the question is due
      pollIn = Math.min(pollIn, Math.max(FAST_S, Math.ceil((times.ask.getTime() - now.getTime()) / 1000)));
      continue;
    }
    const tournament = tournaments.find((x) => x.tournament_id === t.tournamentRounds[0].tournament_id)!;
    prompt = {
      round_id: t.id,
      tournament_id: tournament.tournament_id,
      tournament_name: tournament.tournament_name,
      kolo: t.round_number ?? 0,
      table_number: t.table_number,
      my_team: mine === 1 ? t.team1.team_name : t.team2.team_name,
      opponent: teamLabel(mine === 1 ? t.team2_id : t.team1_id, mine === 1 ? t.team2.team_name : t.team1.team_name),
      matches_per_round: t.matches_per_round,
      published_at: t.published_at!.toISOString(),
      ask_at: times.ask.toISOString(),
      unlock_at: times.unlock.toISOString(),
      skip_at: times.skip.toISOString(),
    };
    pollIn = FAST_S;
    break;
  }

  const notices: AttentionNotice[] = tables
    .filter((t) => t.attendance === "SKIPPED")
    .map((t) => {
      const tournament = tournaments.find((x) => x.tournament_id === t.tournamentRounds[0].tournament_id)!;
      return {
        kind: "skipped" as const,
        round_id: t.id,
        tournament_id: tournament.tournament_id,
        kolo: t.round_number ?? 0,
        table_number: t.table_number,
        teams: [t.team1.team_name, t.team2.team_name] as [string, string],
        organizer_phone: tournament.organizer_phone,
      };
    });

  return {now: now.toISOString(), prompt, notices, poll_in: pollIn};
}
