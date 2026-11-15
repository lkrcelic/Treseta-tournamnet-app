import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLastOpenRoundByPlayerId, OpenRoundScope} from "@/app/_lib/service/round/getLastOpenByPlayerId";
import {getNewestOngoingMatchByRoundId} from "@/app/_lib/service/match/getNewstByRoundId";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {hasLineup} from "@/app/_lib/service/round/lineup";
import {getRoundConferences} from "@/app/_lib/service/league/conferences";
import {nightKolo} from "@/app/_lib/roundStatus";
import {prisma} from "@/app/_lib/prisma";

const SCOPES: OpenRoundScope[] = ["league", "tournament", "any"];

// The round the logged-in player should play now, and its running match if one is started (with its score, team1
// first, for the Continue Game card on Home). hasLineup: who plays it is confirmed, so Start Game can skip that step.
// conferences: the two teams' conferences, team1 first, for the dots on the card (null when the league has none).
// ?scope=league or tournament: only a league's table (Početna · Liga) or a tournament's (Početna · Turniri).
// nightKolo: for a league's table, which of its place's published Kola tonight it is ("Kolo 1/3"); null for a
// tournament's.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const asked = request.nextUrl.searchParams.get("scope") as OpenRoundScope | null;
    const scope = asked && SCOPES.includes(asked) ? asked : "any";
    const round = await getLastOpenRoundByPlayerId(auth.user.id, scope);
    if (!round) {
      return NextResponse.json({error: "Trenutno nemaš otvorenu rundu."}, {status: STATUS.NotFound});
    }

    const [ongoingMatch, lineup, conferences, kola] = await Promise.all([
      getNewestOngoingMatchByRoundId(round.id),
      hasLineup(round.id),
      getRoundConferences(round.id, round.team1_id, round.team2_id),
      round.tournament_id == null ? placeKola(round.id, round.round_date, round.location_slot ?? null) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      roundId: round.id,
      ongoingMatchId: ongoingMatch?.id || null,
      hasLineup: lineup,
      ongoingScore: ongoingMatch ? [ongoingMatch.player_pair1_score ?? 0, ongoingMatch.player_pair2_score ?? 0] : null,
      conferences,
      // which tournament a tournament's table is in (null: a league's), so a tournament's page knows it is its own
      tournamentId: round.tournament_id ?? null,
      nightKolo: kola ? nightKolo(round.round_number, kola) : null,
    }, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Otvorena runda se nije učitala."}, {status: STATUS.ServerError});
  }
}

// The published Kola of a league table's night at its place (both places share the numbers, each counts its own)
async function placeKola(roundId: number, night: Date, slot: number | null): Promise<number[] | null> {
  const link = await prisma.leagueRound.findFirst({where: {round_id: roundId}, select: {league_id: true}});
  if (!link) return null;
  const rows = await prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: link.league_id}}, round_date: night, status: "PUBLISHED", location_slot: slot, round_number: {not: null}},
    select: {round_number: true},
    distinct: ["round_number"],
  });
  return rows.map((r) => r.round_number!);
}
