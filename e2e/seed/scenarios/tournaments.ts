// Turniri in every state a player or an admin can meet, made through the app's own tournament services: created by
// the admin or the organizer, teams signed up by their players (or added by the admin), the waiting list filled by the
// limit, sign-ups closed, cancelled. The played ones (today's and the finished ones) are in tournamentPlay.ts.
import type {Team} from "@prisma/client";
import type {TournamentRequest} from "@/app/_interfaces/tournament";
import {adminAddTeam, signUp} from "@/app/_lib/service/tournament/entries";
import {cancelTournament, createTournament} from "@/app/_lib/service/tournament/tournaments";
import {setRegistrationsOpen} from "@/app/_lib/service/tournament/entries";
import {addDays, isoDay, type Ctx} from "../context";
import type {People} from "./people";
import {placeId} from "./places";
import {GAME_MINUTES_DEFAULT} from "@/app/_lib/gameTime";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";

export type TeamPool = {
  // teams that may enter any tournament: at least two active players, not banned
  eligible: Team[];
  rosters: Map<number, number[]>;
  activeRosters: Map<number, number[]>; // who may press Prijavi ekipu for the team
};

export function tournamentRequest(over: Partial<TournamentRequest> & {name: string; date: string}): TournamentRequest {
  return {
    gathering_time: "17:30",
    start_time: "18:00",
    location_id: placeId("pitanik"),
    rounds: 5,
    matches_per_round: 1,
    declarations: true,
    // Igra se do and Kraj partije (Treseta's own)
    score_threshold: MATCH_THRESHOLD,
    match_end: "S_OVIM_DOSTA",
    max_teams: 16,
    entry_fee: 10,
    rules_url: "https://example.com/pravila-turnira",
    prizes: [
      {prize: "200 €", description: "i pehar"},
      {prize: "100 €", description: ""},
      {prize: "Pršut", description: "domaći, iz Drniša"},
    ],
    game_minutes: GAME_MINUTES_DEFAULT,
    auto_publish: true,
    open_signups: false,
    // Sakrij broj prijava (Bela's, with the sync of 17 Nov 2026): the world's tournaments show their count
    hide_entries: false,
    organizer_phone: "+385 91 000 0001",
    ...over,
  };
}

export async function teamPool(ctx: Ctx, people: People): Promise<TeamPool> {
  const banned = await ctx.prisma.signupBan.findMany({
    where: {lifted_at: null, OR: [{until: null}, {until: {gt: ctx.today}}]},
    select: {team_id: true, player_id: true},
  });
  const bannedTeams = new Set(banned.map((b) => b.team_id).filter((id): id is number => id != null));
  const bannedPlayers = new Set(banned.map((b) => b.player_id).filter((id): id is number => id != null));
  const active = new Set(people.players.filter((p) => p.active).map((p) => p.id));
  for (const p of [people.player, people.partner, people.organizer, people.admin2]) active.add(p.id);
  const eligible = people.teams.filter((t) => {
    const ids = people.rosters.get(t.team_id) ?? [];
    return !bannedTeams.has(t.team_id) && ids.filter((id) => active.has(id)).length >= 2 && !ids.some((id) => bannedPlayers.has(id));
  });
  return {eligible, rosters: people.rosters, activeRosters: people.activeRosters};
}

// n teams with no player in common (a player may be in only one entry of a tournament), skipping `exclude`
export function disjointTeams(ctx: Ctx, pool: TeamPool, n: number, label: string, exclude: Set<number> = new Set()): Team[] {
  const rng = ctx.rng.fork(`teams-${label}`);
  const used = new Set<number>();
  const out: Team[] = [];
  for (const team of rng.shuffle(pool.eligible)) {
    if (out.length === n) break;
    if (exclude.has(team.team_id)) continue;
    const ids = pool.rosters.get(team.team_id)!;
    if (ids.some((id) => used.has(id))) continue;
    ids.forEach((id) => used.add(id));
    out.push(team);
  }
  if (out.length < n) throw new Error(`only ${out.length} of ${n} disjoint teams for ${label}`);
  return out;
}

// signs each team up through its first player, as Prijavi ekipu does; every fourth is added by the admin instead
export async function enter(ctx: Ctx, pool: TeamPool, tournamentId: number, teams: Team[]) {
  for (const [i, team] of Array.from(teams.entries())) {
    if (i % 4 === 3) {
      await adminAddTeam(tournamentId, team.team_id);
    } else {
      const playerId = pool.activeRosters.get(team.team_id)![0];
      await signUp(tournamentId, {id: playerId, player_role: "PLAYER"}, {team_id: team.team_id});
    }
  }
}

export async function seedUpcomingTournaments(ctx: Ctx, people: People, pool: TeamPool) {
  const day = (offset: number) => isoDay(addDays(ctx.today, offset));
  const keep = new Set([people.playerTeam.team_id]);
  const made: [string, string, number][] = [];
  const create = async (key: string, state: string, request: TournamentRequest, by = people.admin.id) => {
    const id = await createTournament(request, by);
    ctx.catalog.tournaments[key] = {id, name: request.name, state};
    made.push([key, state, id]);
    return id;
  };

  // Prijave otvorene: room left, the player's team not in it (so a test can sign it up)
  const open = await create("open", "Prijave otvorene, 9/16, igračeva ekipa nije prijavljena", tournamentRequest({name: "Martinje kup", date: day(5)}));
  await enter(ctx, pool, open, disjointTeams(ctx, pool, 9, "open", keep));

  // Lista čekanja: 8 of 8 in, 3 waiting
  const full = await create(
    "fullWaiting",
    "Pun (8/8) s listom čekanja od 3",
    tournamentRequest({name: "Božićni turnir", date: day(12), max_teams: 8, entry_fee: 15, rounds: 4}),
  );
  await enter(ctx, pool, full, disjointTeams(ctx, pool, 11, "full", keep));

  // Prijave zatvorene by the admin
  const closed = await create("closed", "Prijave zatvorene, 10 ekipa", tournamentRequest({name: "Zatvoreni kup", date: day(3)}));
  await enter(ctx, pool, closed, disjointTeams(ctx, pool, 10, "closed", keep));
  await setRegistrationsOpen(closed, false);

  // Kraj partije "na prolaz" (Treseta's own; Bela has Sakrij broj prijava here), with the player's team in it
  const naProlaz = await create(
    "naProlaz",
    "Na prolaz, igračeva ekipa prijavljena",
    tournamentRequest({name: "Kup na prolaz", date: day(9), match_end: "NA_PROLAZ", max_teams: 12}),
  );
  await signUp(naProlaz, {id: people.player.id, player_role: "PLAYER"}, {team_id: people.playerTeam.team_id});
  await enter(ctx, pool, naProlaz, disjointTeams(ctx, pool, 5, "naprolaz", new Set(Array.from(keep).concat(Array.from(exclusive(pool, people.playerTeam))))));

  // bez zvanja, 2 partije po kolu, no limit, no start time (so no arrival window), free
  const noLimit = await create(
    "noLimitNoDeclarations",
    "Bez limita, bez zvanja, 2 partije po kolu, bez vremena početka",
    tournamentRequest({
      name: "Bez stresa open",
      date: day(15),
      max_teams: null,
      declarations: false,
      matches_per_round: 2,
      entry_fee: 0,
      gathering_time: null,
      start_time: null,
      prizes: [],
      rules_url: null,
      auto_publish: false,
    }),
  );
  await enter(ctx, pool, noLimit, disjointTeams(ctx, pool, 7, "nolimit", keep));

  // Otvorene prijave
  const openSignups = await create(
    "openSignups",
    "Otvorene prijave (i dok traje)",
    tournamentRequest({name: "Kafić open", date: day(6), open_signups: true, max_teams: 14}),
  );
  await enter(ctx, pool, openSignups, disjointTeams(ctx, pool, 6, "opensignups", keep));

  // the organizer's own, and one far in the future with nobody yet
  const mine = await create(
    "organizer",
    "Organizatorov turnir, 5 ekipa",
    tournamentRequest({name: "Organizatorov kup", date: day(7), max_teams: 10}),
    people.organizer.id,
  );
  await enter(ctx, pool, mine, disjointTeams(ctx, pool, 5, "organizer", keep));
  await create("empty", "Bez prijava, za dva mjeseca", tournamentRequest({name: "Proljetni turnir", date: day(60)}));

  // Otkazan
  const cancelled = await create("cancelled", "Otkazan, 4 ekipe", tournamentRequest({name: "Otkazani turnir", date: day(4)}));
  await enter(ctx, pool, cancelled, disjointTeams(ctx, pool, 4, "cancelled", keep));
  await cancelTournament(cancelled, people.admin.id);

  ctx.log(`tournaments (upcoming): ${made.length}`);
}

// teams sharing a player with this team (they can't enter the same tournament)
function exclusive(pool: TeamPool, team: Team): number[] {
  const ids = new Set(pool.rosters.get(team.team_id));
  return Array.from(pool.rosters).filter(([, r]) => r.some((id) => ids.has(id))).map(([teamId]) => teamId);
}
