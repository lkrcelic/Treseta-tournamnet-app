// Zabrane prijava, made by the admin through the app's own bans service (so the players of a banned team get their
// "preko ekipe" bans the way the app makes them): a team until a date, a player for good, a lifted one, plus an
// expired one written directly (the service refuses a date that has passed). A ban also keeps a team from league
// nights, so only teams outside the current league are banned. The automatic Kolo 1 bans come from the tournaments.
import type {Team} from "@prisma/client";
import {banPlayer, banTeam, liftBan} from "@/app/_lib/service/bans/bans";
import {addDays, isoDay, type Ctx} from "../context";
import type {People} from "./people";

export async function seedBans(ctx: Ctx, people: People, outsideTeams: Team[]) {
  const {prisma} = ctx;
  const rng = ctx.rng.fork("bans");
  const admin = {id: people.admin.id, player_role: people.admin.player_role};
  const [bannedTeam, liftedTeam, expiredTeam] = rng.sample(outsideTeams, 3);
  const inLeagues = new Set(
    (await prisma.leagueTeam.findMany({select: {team: {select: {teamPlayers: {select: {player_id: true}}}}}})).flatMap((lt) =>
      lt.team.teamPlayers.map((tp) => tp.player_id),
    ),
  );
  const loner = rng.pick(people.players.filter((p) => p.active && !inLeagues.has(p.id)));

  const latest = async () => (await prisma.signupBan.findFirstOrThrow({orderBy: {id: "desc"}})).id;

  await banTeam(bannedTeam.team_id, {until: isoDay(addDays(ctx.today, 20)), reason: "Svađa sa sucem na turniru"}, admin);
  const teamBan = await prisma.signupBan.findFirstOrThrow({where: {team_id: bannedTeam.team_id, lifted_at: null}});
  ctx.catalog.bans.team = {id: teamBan.id, note: `${bannedTeam.team_name} do ${isoDay(addDays(ctx.today, 20))}, s igračima preko ekipe`};
  ctx.catalog.teams.banned = {id: bannedTeam.team_id, name: bannedTeam.team_name};

  await banPlayer(loner.id, {until: null, reason: "Trajna zabrana (test)"}, admin);
  ctx.catalog.bans.playerForever = {id: await latest(), note: `${loner.first_name} ${loner.last_name}, trajno`};

  await banTeam(liftedTeam.team_id, {until: isoDay(addDays(ctx.today, 40)), reason: "Greška, ukinuto"}, admin);
  const lifted = await prisma.signupBan.findFirstOrThrow({where: {team_id: liftedTeam.team_id, lifted_at: null}});
  await liftBan(lifted.id, true, admin);
  ctx.catalog.bans.lifted = {id: lifted.id, note: `${liftedTeam.team_name}, ukinuta zajedno s igračima`};

  const expired = await prisma.signupBan.create({
    data: {
      team_id: expiredTeam.team_id,
      until: addDays(ctx.today, -3),
      reason: "Istekla zabrana",
      created_by: people.admin.id,
      created_at: addDays(ctx.now, -33),
    },
  });
  ctx.catalog.bans.expired = {id: expired.id, note: `${expiredTeam.team_name}, istekla prije 3 dana`};

  ctx.log(`bans: ${await prisma.signupBan.count()} rows`);
}
