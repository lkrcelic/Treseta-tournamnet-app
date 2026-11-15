// C1's own setup: the league "E2E · Novo kolo" (leagues.newRound: 8 teams, no start time, so no Tu smo) with tonight
// empty before and after each test, so every test builds its own Kolo and --repeat-each never meets the last one's.
import type {APIRequestContext} from "@playwright/test";
import {ONBOARDED, type Db} from "./db";
import {test as base} from "./fixtures";
import {freshClock, putHand, removeNight, savedHand, type SavedHand, type Table} from "./scorepad";

export type Night = {
  league: {id: number; name: string};
  night: string;
  // the admin's request context, for setup through the app's routes
  admin: APIRequestContext;
};

// tables.correction (league "E2E · Scorepad"): the first match, open with 4 hands, seen from a team1 player's phone
export type CorrectionTable = {
  roundId: number;
  matchId: number;
  // the phone's player (team1, so team1 is on the left of the board) and the two teams
  phone: string;
  team1: string;
  team2: string;
  // the hands as the seed saved them, in order
  hands: SavedHand[];
};

// A player of the test's own, in no team yet (the test puts them where it needs them); removed afterwards with their
// team places and lineups. Never logs in.
export type Newcomer = {id: number; username: string; name: string};

export const test = base.extend<{night: Night; correction: CorrectionTable; newcomer: Newcomer}>({
  night: async ({api, db, world}, use) => {
    const {id, name, tonight} = world.leagues.newRound;
    const admin = await api("admin");
    // Novo kolo remembers the admin's choices for tonight (Broj kola, who sits out) on the server
    const clear = async () => {
      await removeNight(admin, id, tonight!);
      await db.createRoundDraft.deleteMany({where: {league_id: id}});
    };
    await clear();
    await use({league: {id, name}, night: tonight!, admin});
    await clear();
  },
  // the match on a fresh clock before the test, and every hand put back as it was after it
  correction: async ({api, db, world}, use) => {
    const {roundId, matchId, team1} = world.tables.correction;
    await freshClock(db, matchId!);
    const phone = await api(team1[0]);
    const round = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {team1: true, team2: true}});
    const ids = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}, select: {result_id: true}});
    const hands: SavedHand[] = [];
    for (const {result_id} of ids) hands.push(await savedHand(phone, result_id));
    await use({roundId, matchId: matchId!, phone: team1[0], team1: round.team1.team_name, team2: round.team2.team_name, hands});
    for (const hand of hands) await putHand(phone, hand);
  },
  newcomer: async ({db}, use) => {
    const username = "e2e.c1.novi";
    await db.player.deleteMany({where: {username}});
    const player = await db.player.create({
      data: {username, email: `${username}@e2e.test`, password_hash: "e2e-never-logs-in", player_role: "PLAYER", first_name: "Novi", last_name: "Treći"},
    });
    await use({id: player.id, username, name: `${player.first_name} ${player.last_name}`});
    await db.player.deleteMany({where: {username}});
  },
});

export {expect} from "./fixtures";

export type Side = {id: number; name: string; players: {id: number; username: string; rating: number}[]};

// Two teams of the league for a table: `home` has a player who opens Početna without an onboarding sheet (`phone`),
// `away` is the first other team with two active players. In alphabetical order, so every run picks the same.
export async function pickTeams(db: Db, leagueId: number): Promise<{home: Side; away: Side; phone: string}> {
  const teams = await db.team.findMany({
    where: {leagueTeams: {some: {league_id: leagueId}}},
    orderBy: {team_name: "asc"},
    include: {teamPlayers: {include: {player: true}}},
  });
  const sides = teams.map((t) => ({
    id: t.team_id,
    name: t.team_name,
    players: t.teamPlayers.filter((tp) => tp.player.active).map((tp) => ({id: tp.player.id, username: tp.player.username, rating: tp.player.rating})),
  }));
  const ready = new Set(
    (await db.player.findMany({where: {...ONBOARDED, id: {in: sides.flatMap((s) => s.players.map((p) => p.id))}}, select: {id: true}})).map((p) => p.id),
  );
  const home = sides.find((s) => s.players.length >= 2 && s.players.some((p) => ready.has(p.id)));
  const away = sides.find((s) => s !== home && s.players.length >= 2);
  if (!home || !away) throw new Error(`league ${leagueId} has no two teams for a table with an onboarded player`);
  return {home, away, phone: home.players.find((p) => ready.has(p.id))!.username};
}

// The table seen from the home team's phone (home on the left of the board): the round's sides of the two teams
export function sidesOf(table: Table, home: Side) {
  const homeSide: 1 | 2 = table.team1.id === home.id ? 1 : 2;
  const awaySide: 1 | 2 = homeSide === 1 ? 2 : 1;
  return {
    homeSide,
    awaySide,
    // [home, away] from a pair stored by the round's sides
    byTeam: <T>(one: T, two: T): [T, T] => (homeSide === 1 ? [one, two] : [two, one]),
    // a pair by the round's sides from [home, away]
    bySide: <T>(home: T, away: T): [T, T] => (homeSide === 1 ? [home, away] : [away, home]),
  };
}
