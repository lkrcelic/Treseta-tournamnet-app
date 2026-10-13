import {Prisma, RoleEnum} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {AdminPlayerRow, AdminPlayerUpdate, PLAYER_NOT_FOUND, PlayerActiveResponse, PlayerView} from "@/app/_interfaces/player";
import {AdminAction, AdminTarget, adminActionError, adminPlayerRows, anonymisedPlayerData, isAdminRole} from "@/app/_lib/players/admin";
import {playerView, Viewer} from "@/app/_lib/players/privacy";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {lockRatings} from "@/app/_lib/service/admin/recalc";
import {closeActivePosts, lockPlayerAds} from "@/app/_lib/service/burza/burza";
import {freezeRosterLineups} from "@/app/_lib/service/team/freezeLineups";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";

// What an admin does to a player (handoff §6 "Admin controls"): the Igrači directory, "Uredi osobne podatke" (Spremi),
// and the account actions in its Račun section, which apply at once. The rules are in _lib/players/admin.ts.

// One admin change to a player at a time, so two admins can't take the last admin role away from each other at once
const ADMINS_LOCK = 7314002;

type Tx = Prisma.TransactionClient;

// The Igrači directory and the "Dodaj igrača" options: everyone but the deleted players
export async function listAdminPlayers(): Promise<AdminPlayerRow[]> {
  const players = await prisma.player.findMany({
    where: {deleted_at: null},
    select: {
      id: true,
      first_name: true,
      last_name: true,
      username: true,
      active: true,
      teamPlayers: {select: {team: {select: {team_id: true, team_name: true}}}},
    },
  });
  return adminPlayerRows(players.map(({teamPlayers, ...p}) => ({...p, teams: teamPlayers.map((tp) => tp.team)})));
}

// The fields the privacy filter reads (playerView), for the answer to Spremi
const viewSelect = {
  id: true,
  first_name: true,
  last_name: true,
  active: true,
  username: true,
  email: true,
  phone: true,
  birth_date: true,
  smoker: true,
  player_role: true,
} as const;

// Spremi found the new username or email on another player (409); the panel shows it under that field
export type PlayerFieldConflict = {conflicts: ("username" | "email")[]};

// "Uredi osobne podatke" → Spremi: the changed fields in one update. Giving the admin role is an update; taking it away
// is refused for yourself and for the last admin.
export async function adminUpdatePlayer(viewer: Viewer, id: number, body: AdminPlayerUpdate): Promise<PlayerView | PlayerFieldConflict> {
  return prisma.$transaction(async (tx) => {
    const target = await allowed(tx, viewer, id, (t) => (body.is_admin === false && isAdminRole(t) ? "demote" : "update"));

    const conflicts: PlayerFieldConflict["conflicts"] = [];
    if (body.username !== undefined && (await takenBy(tx, {username: anyCase(body.username)}, id))) conflicts.push("username");
    if (body.email !== undefined && (await takenBy(tx, {email: anyCase(body.email)}, id))) conflicts.push("email");
    if (conflicts.length) return {conflicts};

    const {first_name, last_name, username, email, phone, birth_date, smoker, is_admin} = body;
    const player = await tx.player.update({
      where: {id: target.id},
      data: {
        ...(first_name !== undefined && {first_name}),
        ...(last_name !== undefined && {last_name}),
        ...(username !== undefined && {username}),
        ...(email !== undefined && {email}),
        ...(phone !== undefined && {phone}),
        ...(birth_date !== undefined && {birth_date: birth_date ? new Date(birth_date) : null}),
        // answered, so the app doesn't ask "Pušiš li?" again
        ...(smoker !== undefined && {smoker, smoker_answered: true}),
        ...(is_admin !== undefined && {player_role: is_admin ? RoleEnum.ADMIN : RoleEnum.PLAYER}),
      },
      select: viewSelect,
    });
    return playerView(player, viewer);
  });
}

// "Deaktiviraj račun" / "Aktiviraj račun". A deactivated player is logged out everywhere (their sessions are deleted)
// and their ads that are still up close (an expired one stays Istekao); their teams, results and rating stay.
// Activating again doesn't reopen the ads.
export async function setPlayerActive(viewer: Viewer, id: number, active: boolean): Promise<PlayerActiveResponse> {
  return prisma.$transaction(async (tx) => {
    await allowed(tx, viewer, id, () => (active ? "activate" : "deactivate"));
    // before the row is written: an ad being published right now finishes first, or sees the account deactivated
    await lockPlayerAds(tx, id);
    await tx.player.update({where: {id}, data: {active}});
    if (!active) {
      await tx.session.deleteMany({where: {userId: id}});
      await tx.luciaSession.deleteMany({where: {userId: id}});
      await closeActivePosts(tx, id);
    }
    return {id, active};
  });
}

/**
 * "Obriši igrača": the player leaves every team, their ads are deleted (they hold a phone number and a note), they are
 * logged out and their Google login is unlinked, and the row becomes "Obrisani igrač" (anonymisedPlayerData). The
 * rounds they played stay, with them in the lineups (freezeRosterLineups first), so nobody's rating changes; a
 * teammate's substitute ad that names them reads "igra s: Obrisani igrač".
 */
export async function anonymisePlayer(viewer: Viewer, id: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await allowed(tx, viewer, id, () => "delete");
      await lockRatings(tx);
      await lockPlayerAds(tx, id);
      const teams = await tx.teamPlayer.findMany({where: {player_id: id}, select: {team_id: true}});
      await freezeRosterLineups(tx, teams.map((t) => t.team_id));
      await tx.teamPlayer.deleteMany({where: {player_id: id}});
      await tx.marketPost.deleteMany({where: {player_id: id}});
      await tx.session.deleteMany({where: {userId: id}});
      await tx.luciaSession.deleteMany({where: {userId: id}});
      await tx.account.deleteMany({where: {userId: id}});
      await tx.player.update({where: {id}, data: await anonymised(tx, id, new Date())});
    },
    {timeout: 30_000}
  );
}

// Takes the admin lock and checks the rules for this action on the player: a missing or deleted player is a 404
// (NotFoundError), a refused action a 400 with the reason. Returns the player.
async function allowed(tx: Tx, viewer: Viewer, id: number, action: (target: AdminTarget) => AdminAction): Promise<AdminTarget> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMINS_LOCK})`;
  const target = await tx.player.findUnique({where: {id}, select: {id: true, player_role: true, active: true, deleted_at: true}});
  const adminCount = await tx.player.count({where: {player_role: RoleEnum.ADMIN, active: true, deleted_at: null}});
  const error = adminActionError(viewer, target, target ? action(target) : "update", {adminCount});
  if (error === PLAYER_NOT_FOUND) throw new NotFoundError(error);
  if (error) throw new InvalidResultError(error);
  return target!;
}

async function takenBy(tx: Tx, where: Prisma.PlayerWhereInput, id: number): Promise<boolean> {
  return (await tx.player.findFirst({where: {...where, id: {not: id}}, select: {id: true}})) != null;
}

// The anonymised row, with a username and email nobody else has (someone could have picked "obrisani_<id>")
async function anonymised(tx: Tx, id: number, now: Date) {
  for (let attempt = 1; attempt <= 50; attempt++) {
    const data = anonymisedPlayerData(id, now, attempt);
    if (!(await takenBy(tx, {OR: [{username: anyCase(data.username)}, {email: anyCase(data.email)}]}, id))) return data;
  }
  throw new Error(`no free anonymised username for player ${id}`);
}
