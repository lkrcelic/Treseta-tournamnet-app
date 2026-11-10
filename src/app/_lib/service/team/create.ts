import {prisma} from "@/app/_lib/prisma";
import {Prisma, Team} from "@prisma/client";
import {TEAM_NAME_TAKEN, TeamCreateRequest} from "@/app/_interfaces/team";
import {PLAYER_DEACTIVATED} from "@/app/_interfaces/player";
import {activeLeagueId, leagueExists} from "@/app/_lib/service/league/leagues";
import {lockRatings} from "@/app/_lib/service/admin/recalc";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {teamNameTaken} from "./update";

// Creates a team with its players and adds it to a league, so it can be picked for rounds: the given league, none
// for league_id null (the admin's "Nova ekipa"), or the league being played now when league_id is left out.
// The first two players are recorded as its founders; a team may start without players and get them later. Only
// active players can be in it (a deleted player has no account any more).
export async function createTeam(request: TeamCreateRequest, creatorId: number): Promise<Team> {
  if (await teamNameTaken(request.team_name)) {
    throw new InvalidResultError(TEAM_NAME_TAKEN);
  }

  const leagueId = request.league_id === undefined ? await activeLeagueId() : request.league_id;
  if (leagueId != null && (!isDbId(leagueId) || !(await leagueExists(leagueId)))) {
    throw new InvalidResultError("Liga ne postoji.");
  }

  return prisma.$transaction((tx) => insertTeam(tx, request, creatorId, leagueId), {timeout: 20_000});
}

// The team's row and roster inside a transaction (also a tournament's "Kreiraj ekipu i prijavi"); the name is checked
// by the caller, the unique index catches a race
export async function insertTeam(tx: Prisma.TransactionClient, request: TeamCreateRequest, creatorId: number, leagueId: number | null): Promise<Team> {
  // the players are read after the lock: deleting a player (anonymisePlayer) holds it too, so a player deleted
  // while this waited isn't put in the team afterwards
  await lockRatings(tx);
  const ids = request.players.filter(isDbId);
  const players = await tx.player.findMany({where: {id: {in: ids}, deleted_at: null}, select: {active: true}});
  if (players.length !== request.players.length) {
    throw new InvalidResultError("Svi igrači moraju imati račun.");
  }
  if (players.some((p) => !p.active)) throw new InvalidResultError(PLAYER_DEACTIVATED);

  return tx.team.create({
    data: {
      team_name: request.team_name,
      founder_id1: request.players[0] ?? null,
      founder_id2: request.players[1] ?? null,
      creator_id: creatorId,
      teamPlayers: {
        create: request.players.map((player_id) => ({player_id})),
      },
      ...(leagueId != null && {leagueTeams: {create: {league_id: leagueId}}}),
    },
  });
}
