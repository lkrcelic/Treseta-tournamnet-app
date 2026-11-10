import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/app/_lib/prisma";
import {leagueDateString} from "@/app/_lib/dates";
import {displayName} from "@/app/_lib/players/names";
import {Viewer} from "@/app/_lib/players/privacy";
import {banActive, banDay, PlayBan, playBanRefusal, playBanText} from "@/app/_lib/bans";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {isIsoDate} from "@/app/_lib/nights";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";

// Zabrana prijava (admin's Ekipa and Igrač): a team or a player may not sign up for any tournament while a ban is in
// force, and the team doesn't play the league's nights either (no Tu smo; Novo kolo, Novi stol, Uredi stolove and
// Dodaj ekipu leave it out; DECISIONS #73). A team's ban comes with a ban for each player whose box stays ticked
// ("Vrijedi i za igrače"); a player's ban through the team's shows "preko ekipe" and goes when the team's ban is lifted
// with "Ukini i igračima" (or changed without that player). A ban runs out by itself; Ukini ends it early. The reason
// is for admins only.

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const BanRequestValidation = z.object({
  // the first day it no longer holds (YYYY-MM-DD, after today); null = Trajno
  until: z.string().refine(isIsoDate, "Neispravan datum.").nullable(),
  reason: z.string().trim().max(200, "Razlog može imati najviše 200 znakova.").default(""),
  // a team's ban: the players it holds for too
  player_ids: z.array(z.number().int()).max(20).optional(),
});
export type BanRequest = {until: string | null; reason: string; player_ids?: number[]};

export const LiftRequestValidation = z.object({with_players: z.boolean().optional()});

// A ban as the screens show it
export type BanView = {
  id: number;
  until: string | null;
  // for admins only (empty for a player's own view)
  reason: string;
  created_at: string;
  // the admin who set it; null: the app (a no-show in Kolo 1)
  created_by: string | null;
  // a player's ban through a team's: that team
  via_team: {team_id: number; team_name: string} | null;
  // a team's ban: the players it holds for too
  players: {id: number; name: string}[];
};

const banSelect = {
  id: true,
  team_id: true,
  player_id: true,
  until: true,
  reason: true,
  created_at: true,
  lifted_at: true,
  creator: {select: {first_name: true, last_name: true}},
  via: {select: {team: {select: {team_id: true, team_name: true}}}},
  playerBans: {where: {lifted_at: null}, select: {player: {select: {id: true, first_name: true, last_name: true}}}},
} as const;

type BanRow = Prisma.SignupBanGetPayload<{select: typeof banSelect}>;

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
export const today = () => leagueDateString();
const inForce = {lifted_at: null} as const;

function view(b: BanRow): BanView {
  return {
    id: b.id,
    until: isoDay(b.until),
    reason: b.reason,
    created_at: b.created_at.toISOString(),
    created_by: b.creator ? displayName(b.creator) : null,
    via_team: b.via?.team ? {team_id: b.via.team.team_id, team_name: b.via.team.team_name} : null,
    players: b.playerBans.map((p) => ({id: p.player!.id, name: displayName(p.player!)})).sort((a, c) => a.name.localeCompare(c.name, "hr")),
  };
}

// The longest of the bans in force (Trajno beats a date)
function strongest(rows: BanRow[]): BanRow | null {
  const now = today();
  const active = rows.filter((b) => banActive({until: isoDay(b.until), lifted: b.lifted_at != null}, now));
  if (active.length === 0) return null;
  return active.sort((a, b) => (a.until == null ? -1 : b.until == null ? 1 : b.until.getTime() - a.until.getTime()))[0];
}

// The bans in force of these teams and players (the longest one of each)
export async function activeBans({teamIds = [], playerIds = []}: {teamIds?: number[]; playerIds?: number[]}, db: Db = prisma) {
  const rows =
    teamIds.length === 0 && playerIds.length === 0
      ? []
      : await db.signupBan.findMany({
          where: {...inForce, OR: [{team_id: {in: teamIds}}, {player_id: {in: playerIds}}]},
          select: banSelect,
        });
  const teams = new Map<number, BanView>();
  const players = new Map<number, BanView>();
  for (const id of teamIds) {
    const b = strongest(rows.filter((r) => r.team_id === id));
    if (b) teams.set(id, view(b));
  }
  for (const id of playerIds) {
    const b = strongest(rows.filter((r) => r.player_id === id));
    if (b) players.set(id, view(b));
  }
  return {teams, players};
}

// Why a team can't sign up (or be added): its ban, or a player's; null when nothing stops it
export async function banReason(team: {team_id: number; players: {id: number; first_name: string; last_name: string}[]}, viewerId: number | null, db: Db = prisma): Promise<{text: string; until: string | null} | null> {
  const {teams, players} = await activeBans({teamIds: [team.team_id], playerIds: team.players.map((p) => p.id)}, db);
  const t = teams.get(team.team_id);
  if (t) return {text: t.until ? `Zabrana prijava do ${banDay(t.until)}` : "Trajna zabrana prijava", until: t.until};
  const banned = team.players.find((p) => players.has(p.id));
  if (!banned) return null;
  const b = players.get(banned.id)!;
  const who = banned.id === viewerId ? "Tebi su" : `Igraču ${displayName(banned)} su`;
  return {text: `${who} prijave zabranjene${b.until ? ` do ${banDay(b.until)}` : ""}.`, until: b.until};
}

// The bans that keep teams from the league's nights: a team's own, else the longest of its players' (Trajno beats a
// date). Only the banned teams are in the map.
export async function teamPlayBans(teamIds: number[], db: Db = prisma): Promise<Map<number, PlayBan>> {
  const ids = Array.from(new Set(teamIds.filter((id) => id !== BYE_TEAM_ID)));
  if (ids.length === 0) return new Map();
  const roster = await db.teamPlayer.findMany({
    where: {team_id: {in: ids}},
    select: {team_id: true, player: {select: {id: true, first_name: true, last_name: true}}},
  });
  const {teams, players} = await activeBans({teamIds: ids, playerIds: Array.from(new Set(roster.map((r) => r.player.id)))}, db);
  const bans = new Map<number, PlayBan>();
  for (const id of ids) {
    const own = teams.get(id);
    if (own) {
      bans.set(id, {until: own.until, player: null, player_id: null});
      continue;
    }
    const held = roster
      .filter((r) => r.team_id === id && players.has(r.player.id))
      .map((r) => ({until: players.get(r.player.id)!.until, player: displayName(r.player), player_id: r.player.id}))
      .sort((a, b) => (a.until == null ? -1 : b.until == null ? 1 : b.until.localeCompare(a.until)) || a.player.localeCompare(b.player, "hr"));
    if (held.length > 0) bans.set(id, held[0]);
  }
  return bans;
}

// Refuses teams that may not play the league's nights, naming each with its ban (Tu smo, Novo kolo, Novi stol, Uredi
// stolove, Dodaj ekipu, Nova liga, and publishing a Skica: prefix says what was refused)
export async function assertMayPlay(teamIds: number[], db: Db = prisma, prefix = ""): Promise<void> {
  const bans = await teamPlayBans(teamIds, db);
  if (bans.size === 0) return;
  const names = await db.team.findMany({where: {team_id: {in: Array.from(bans.keys())}}, select: {team_id: true, team_name: true}});
  const teams = names.map((t) => ({name: t.team_name, ban: bans.get(t.team_id)!})).sort((a, b) => a.name.localeCompare(b.name, "hr"));
  throw new InvalidResultError(prefix + playBanRefusal(teams));
}

// A new team made for a league: none of its players may be banned
export async function assertPlayersMayPlay(playerIds: number[], db: Db = prisma): Promise<void> {
  const {players} = await activeBans({playerIds}, db);
  if (players.size === 0) return;
  const rows = await db.player.findMany({where: {id: {in: Array.from(players.keys())}}, select: {id: true, first_name: true, last_name: true}});
  const list = rows
    .map((p) => playBanText({until: players.get(p.id)!.until, player: displayName(p)}))
    .sort((a, b) => a.localeCompare(b, "hr"))
    .join(", ");
  throw new InvalidResultError(`Ekipa se ne može dodati u ligu jer igrač ima zabranu (${list}).`);
}

function checkUntil(until: string | null) {
  if (until != null && until <= today()) throw new InvalidResultError("Zabrana mora trajati barem do sutra.");
}

const untilValue = (until: string | null) => (until ? new Date(`${until}T00:00:00.000Z`) : null);

// Zabrani prijave ekipi: the team, and each of player_ids (its players; all of them unless boxes were unticked)
export async function banTeam(teamId: number, request: BanRequest, admin: Viewer): Promise<void> {
  checkUntil(request.until);
  await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({where: {team_id: teamId}, select: {teamPlayers: {select: {player_id: true}}}});
    if (!team) throw new NotFoundError("Ekipa ne postoji.");
    const roster = new Set(team.teamPlayers.map((tp) => tp.player_id));
    const players = (request.player_ids ?? Array.from(roster)).filter((id) => roster.has(id));
    // a new ban replaces the one in force
    await tx.signupBan.updateMany({where: {OR: [{team_id: teamId}, {via: {team_id: teamId}}], ...inForce}, data: {lifted_at: new Date(), lifted_by: admin.id}});
    const ban = await tx.signupBan.create({
      data: {team_id: teamId, until: untilValue(request.until), reason: request.reason, created_by: admin.id},
      select: {id: true},
    });
    if (players.length > 0) {
      await tx.signupBan.createMany({
        data: players.map((player_id) => ({player_id, via_ban_id: ban.id, until: untilValue(request.until), reason: request.reason, created_by: admin.id})),
      });
    }
  });
}

// Zabrani prijave igraču: the player alone (a ban of their own replaces their earlier own one; one through a team stays)
export async function banPlayer(playerId: number, request: BanRequest, admin: Viewer): Promise<void> {
  checkUntil(request.until);
  await prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({where: {id: playerId}, select: {id: true}});
    if (!player) throw new NotFoundError("Igrač ne postoji.");
    await tx.signupBan.updateMany({where: {player_id: playerId, via_ban_id: null, ...inForce}, data: {lifted_at: new Date(), lifted_by: admin.id}});
    await tx.signupBan.create({data: {player_id: playerId, until: untilValue(request.until), reason: request.reason, created_by: admin.id}});
  });
}

// Promijeni: a new end, reason and (for a team) players. The ban keeps its author and start.
export async function changeBan(banId: number, request: BanRequest, admin: Viewer): Promise<void> {
  checkUntil(request.until);
  await prisma.$transaction(async (tx) => {
    const ban = await tx.signupBan.findUnique({where: {id: banId}, select: {id: true, team_id: true, lifted_at: true, team: {select: {teamPlayers: {select: {player_id: true}}}}}});
    if (!ban || ban.lifted_at) throw new NotFoundError("Zabrana više ne vrijedi.");
    await tx.signupBan.update({where: {id: banId}, data: {until: untilValue(request.until), reason: request.reason}});
    if (ban.team_id == null || !request.player_ids) return;
    const roster = new Set(ban.team?.teamPlayers.map((tp) => tp.player_id) ?? []);
    const wanted = request.player_ids.filter((id) => roster.has(id));
    const current = await tx.signupBan.findMany({where: {via_ban_id: banId, ...inForce}, select: {id: true, player_id: true}});
    const off = current.filter((c) => !wanted.includes(c.player_id!)).map((c) => c.id);
    if (off.length > 0) await tx.signupBan.updateMany({where: {id: {in: off}}, data: {lifted_at: new Date(), lifted_by: admin.id}});
    await tx.signupBan.updateMany({where: {via_ban_id: banId, ...inForce}, data: {until: untilValue(request.until), reason: request.reason}});
    const add = wanted.filter((id) => !current.some((c) => c.player_id === id));
    if (add.length > 0) {
      await tx.signupBan.createMany({
        data: add.map((player_id) => ({player_id, via_ban_id: banId, until: untilValue(request.until), reason: request.reason, created_by: admin.id})),
      });
    }
  });
}

// Ukini: ends the ban now; a team's with_players also ends its players' bans through it
export async function liftBan(banId: number, withPlayers: boolean, admin: Viewer): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ban = await tx.signupBan.findUnique({where: {id: banId}, select: {id: true, lifted_at: true}});
    if (!ban) throw new NotFoundError("Zabrana ne postoji.");
    const data = {lifted_at: new Date(), lifted_by: admin.id};
    if (!ban.lifted_at) await tx.signupBan.update({where: {id: banId}, data});
    if (withPlayers) await tx.signupBan.updateMany({where: {via_ban_id: banId, ...inForce}, data});
  });
}

// The app's own ban after a no-show in Kolo 1: the team and its players, from today for NO_SHOW_BAN_MONTHS. Once per
// team and tournament.
export async function autoBanTeam(tx: Tx, teamId: number, tournament: {tournament_id: number; tournament_name: string}, until: string): Promise<void> {
  const existing = await tx.signupBan.count({where: {team_id: teamId, tournament_id: tournament.tournament_id}});
  if (existing > 0) return;
  const team = await tx.team.findUnique({where: {team_id: teamId}, select: {teamPlayers: {select: {player_id: true}}}});
  if (!team) return;
  const reason = `Nedolazak u 1. kolu · ${tournament.tournament_name}`.slice(0, 200);
  const ban = await tx.signupBan.create({data: {team_id: teamId, until: untilValue(until), reason, tournament_id: tournament.tournament_id}, select: {id: true}});
  if (team.teamPlayers.length > 0) {
    await tx.signupBan.createMany({
      data: team.teamPlayers.map((tp) => ({player_id: tp.player_id, via_ban_id: ban.id, until: untilValue(until), reason, tournament_id: tournament.tournament_id})),
    });
  }
}

// For the admin's Ekipa: the team's ban in force (with the players it holds for), and each player's
export async function teamBanState(teamId: number) {
  const team = await prisma.team.findUnique({where: {team_id: teamId}, select: {teamPlayers: {select: {player_id: true}}}});
  if (!team) throw new NotFoundError("Ekipa ne postoji.");
  const playerIds = team.teamPlayers.map((tp) => tp.player_id);
  const {teams, players} = await activeBans({teamIds: [teamId], playerIds});
  return {ban: teams.get(teamId) ?? null, players: Object.fromEntries(playerIds.map((id) => [id, players.get(id) ?? null]))};
}

// For the admin's Igrač: the player's ban in force, and each of their teams'
export async function playerBanState(playerId: number) {
  const teams = await prisma.teamPlayer.findMany({where: {player_id: playerId}, select: {team_id: true}});
  const teamIds = teams.map((t) => t.team_id);
  const bans = await activeBans({teamIds, playerIds: [playerId]});
  return {ban: bans.players.get(playerId) ?? null, teams: Object.fromEntries(teamIds.map((id) => [id, bans.teams.get(id) ?? null]))};
}
