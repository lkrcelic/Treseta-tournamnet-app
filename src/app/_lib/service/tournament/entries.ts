import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {Viewer} from "@/app/_lib/players/privacy";
import {isAdminRole} from "@/app/_lib/players/admin";
import {displayName} from "@/app/_lib/players/names";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {insertTeam} from "@/app/_lib/service/team/create";
import {teamNameTaken} from "@/app/_lib/service/team/update";
import {TEAM_NAME_TAKEN} from "@/app/_interfaces/team";
import {CandidateTeam, RegistrationRequest} from "@/app/_interfaces/tournament";
import {playersInOtherEntries, signUpStatus} from "@/app/_lib/tournamentEntries";
import {joinsAsPresent} from "@/app/_lib/tournaments";
import {hasRoom} from "@/app/_lib/tournamentDay";
import {dayClosed, dayEntries, LAST_KOLO_MADE, lastKoloIsMade} from "./day";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {banDay} from "@/app/_lib/bans";
import {activeBans, banReason} from "@/app/_lib/service/bans/bans";
import {lockTournament} from "./lock";
import {applyLimit, dropDrafts, TOURNAMENT_NOT_FOUND} from "./tournaments";

// Signing a team up (a player's Prijavi ekipu, the admin's Dodaj ekipu), signing it off, the waiting list (Ubaci u
// turnir) and Prijave otvorene. Every change holds the tournament's lock, so two teams can't both take the last place.

type Tx = Prisma.TransactionClient;

export const SIGN_UPS_CLOSED = "Prijave su zatvorene.";
export const TOURNAMENT_STARTED = "Turnir je već počeo.";
export const TEAM_NEEDS_TWO = "Ekipa treba barem dva igrača s računom.";

// The tournament, locked, as long as its teams can still change (before it starts, not cancelled)
async function lockOpenTournament(tx: Tx, tournamentId: number) {
  await lockTournament(tx, tournamentId);
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
  if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
  if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
  if (t.started_at) throw new InvalidResultError(TOURNAMENT_STARTED);
  return t;
}

/**
 * The same, but a tournament with **Otvorene prijave** also takes teams while it is being played (DECISIONS #88),
 * right up to the moment its last Kolo is made — after that there is no next Kolo to come into, the same rule that
 * stops Tu smo · Želimo uskočiti.
 *
 * `during` says the day's switch has already run on a tournament with Otvorene prijave, so the team that comes in
 * counts as present: it is marked arrived and plays from the next Kolo, or waits (confirmed) when the tournament is
 * full. That starts at the start time, not at Kolo 1 — between the two, a team that signs up is just as much here.
 * A tournament without Otvorene prijave is untouched by all of this.
 */
async function lockTournamentForEntry(tx: Tx, tournamentId: number): Promise<{t: Awaited<ReturnType<typeof lockOpenTournament>>; during: boolean}> {
  await lockTournament(tx, tournamentId);
  const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
  if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
  if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
  if (t.started_at) {
    if (!t.open_signups) throw new InvalidResultError(TOURNAMENT_STARTED);
    if (await lastKoloIsMade(tx, t)) throw new InvalidResultError(LAST_KOLO_MADE);
  }
  return {t, during: joinsAsPresent({openSignups: t.open_signups, dayClosed: dayClosed(t)})};
}

// A team's players with an account (deleted ones are left out)
async function rosterOf(tx: Tx, teamId: number) {
  const team = await tx.team.findUnique({
    where: {team_id: teamId},
    select: {team_id: true, team_name: true, teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, active: true, deleted_at: true}}}}},
  });
  if (!team) throw new NotFoundError("Ekipa ne postoji.");
  return {...team, players: team.teamPlayers.map((tp) => tp.player).filter((p) => p.deleted_at == null)};
}

// Refuses a team with fewer than two active players, a team that (or whose player) may not sign up (Zabrana prijava),
// or a team with a player who already plays in another entry
async function assertCanEnter(tx: Tx, tournamentId: number, team: Awaited<ReturnType<typeof rosterOf>>, viewerId: number | null = null) {
  if (team.players.filter((p) => p.active).length < 2) throw new InvalidResultError(TEAM_NEEDS_TWO);
  const ban = await banReason(team, viewerId, tx);
  if (ban) throw new InvalidResultError(ban.text.endsWith(".") ? ban.text : `${ban.text}.`);
  const entries = await tx.tournamentTeam.findMany({
    where: {tournament_id: tournamentId},
    select: {team_id: true, team: {select: {team_name: true, teamPlayers: {select: {player_id: true}}}}},
  });
  if (entries.some((e) => e.team_id === team.team_id)) throw new InvalidResultError("Ekipa je već prijavljena.");
  const others = entries.map((e) => ({teamId: e.team_id, playerIds: e.team.teamPlayers.map((tp) => tp.player_id)}));
  const taken = playersInOtherEntries(team.players.map((p) => p.id), others);
  if (taken.length > 0) {
    const who = team.players.find((p) => p.id === taken[0])!;
    const where = entries.find((e) => e.team.teamPlayers.some((tp) => tp.player_id === who.id))!;
    throw new InvalidResultError(`${displayName(who)} je već prijavljen s ekipom ${where.team.team_name}.`);
  }
}

async function enter(tx: Tx, tournamentId: number, teamId: number, maxTeams: number | null, by: number | null, during = false, byAdmin = false) {
  if (during) {
    // the tournament is running: whoever signs up now is here (so, arrived), and plays from the next Kolo while
    // there is room — else they wait, confirmed, and come in as soon as a place opens (fillPlaces)
    const entries = await dayEntries(tx, tournamentId);
    const status = hasRoom(entries, maxTeams) ? "REGISTERED" : "WAITING";
    await tx.tournamentTeam.create({
      data: {tournament_id: tournamentId, team_id: teamId, status, registered_by: by, active: true, arrived_at: new Date(), arrived_by: byAdmin ? null : by, arrived_by_admin: byAdmin},
    });
    return status;
  }
  const registered = await tx.tournamentTeam.count({where: {tournament_id: tournamentId, status: "REGISTERED"}});
  const status = signUpStatus(registered, maxTeams);
  await tx.tournamentTeam.create({data: {tournament_id: tournamentId, team_id: teamId, status, registered_by: by}});
  return status;
}

// A player's Prijavi ekipu: one of their teams, or a new team of them and a partner made and signed up in one step.
// While the tournament is full the team goes on the waiting list.
export async function signUp(tournamentId: number, viewer: Viewer, request: RegistrationRequest): Promise<{teamId: number; status: "REGISTERED" | "WAITING"}> {
  if ("new_team" in request) {
    const {name, partner_id} = request.new_team;
    if (partner_id === viewer.id) throw new InvalidResultError("Odaberi suigrača.");
    if (await teamNameTaken(name)) throw new InvalidResultError(TEAM_NAME_TAKEN);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const {t, during} = await lockTournamentForEntry(tx, tournamentId);
      if (!t.registrations_open) throw new InvalidResultError(SIGN_UPS_CLOSED);
      // a banned player signs up no team and makes no new one
      const mine = (await activeBans({playerIds: [viewer.id]}, tx)).players.get(viewer.id);
      if (mine) throw new InvalidResultError(`Prijave su ti zabranjene${mine.until ? ` do ${banDay(mine.until)}` : ""}. Za pitanja se javi organizatoru.`);
      let teamId: number;
      if ("new_team" in request) {
        const partner = await tx.player.findFirst({where: {id: request.new_team.partner_id, deleted_at: null, active: true}, select: {id: true, first_name: true, last_name: true}});
        if (!partner) throw new InvalidResultError("Suigrač mora imati račun u aplikaciji.");
        const partnerBan = (await activeBans({playerIds: [partner.id]}, tx)).players.get(partner.id);
        if (partnerBan) throw new InvalidResultError(`Igraču ${displayName(partner)} su prijave zabranjene${partnerBan.until ? ` do ${banDay(partnerBan.until)}` : ""}.`);
        // nobody of the new team may already play in another entry: checked before the team is made
        await assertNotEntered(tx, tournamentId, [viewer.id, partner.id]);
        const team = await insertTeam(tx, {team_name: request.new_team.name.trim(), players: [viewer.id, partner.id], league_id: null}, viewer.id, null);
        teamId = team.team_id;
      } else {
        teamId = request.team_id;
      }
      const team = await rosterOf(tx, teamId);
      if (!team.players.some((p) => p.id === viewer.id)) throw new InvalidResultError("Možeš prijaviti samo ekipu u kojoj igraš.");
      await assertCanEnter(tx, tournamentId, team, viewer.id);
      const status = await enter(tx, tournamentId, teamId, t.max_teams, viewer.id, during);
      return {teamId, status};
    }, {timeout: 20_000});
  } catch (error) {
    // two sign-ups with the same new name at once: the unique index refuses the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InvalidResultError(TEAM_NAME_TAKEN);
    throw error;
  }
}

async function assertNotEntered(tx: Tx, tournamentId: number, playerIds: number[]) {
  const entry = await tx.tournamentTeam.findFirst({
    where: {tournament_id: tournamentId, team: {teamPlayers: {some: {player_id: {in: playerIds}}}}},
    select: {team: {select: {team_name: true, teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true}}}}}}},
  });
  if (!entry) return;
  const who = entry.team.teamPlayers.map((tp) => tp.player).find((p) => playerIds.includes(p.id))!;
  throw new InvalidResultError(`${displayName(who)} je već prijavljen s ekipom ${entry.team.team_name}.`);
}

// Odjavi ekipu (a player of the team) or Makni ekipu (an admin), before the tournament starts. A team that was in
// frees its place for the first team waiting, which comes in without a notice.
export async function signOff(tournamentId: number, teamId: number, viewer: Viewer): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockOpenTournament(tx, tournamentId);
    const entry = await tx.tournamentTeam.findUnique({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});
    if (!entry) throw new NotFoundError("Ekipa nije prijavljena na ovaj turnir.");
    if (!isAdminRole(viewer)) {
      const member = await tx.teamPlayer.count({where: {team_id: teamId, player_id: viewer.id}});
      if (!member) throw new InvalidResultError("Možeš odjaviti samo ekipu u kojoj igraš.");
    }
    await tx.tournamentTeam.delete({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});
    if (entry.status === "REGISTERED") await applyLimit(tx, tournamentId, t.max_teams);
  });
}

// The admin's Dodaj ekipu: in while there is room, else on the waiting list
export async function adminAddTeam(tournamentId: number, teamId: number): Promise<"REGISTERED" | "WAITING"> {
  return prisma.$transaction(async (tx) => {
    const {t, during} = await lockTournamentForEntry(tx, tournamentId);
    await assertCanEnter(tx, tournamentId, await rosterOf(tx, teamId));
    return enter(tx, tournamentId, teamId, t.max_teams, null, during, true);
  }, {timeout: 20_000});
}

// Ubaci u turnir: a team from the waiting list comes in now, and the limit grows by one for it
export async function admitTeam(tournamentId: number, teamId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const t = await lockOpenTournament(tx, tournamentId);
    const entry = await tx.tournamentTeam.findUnique({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}});
    if (!entry) throw new NotFoundError("Ekipa nije prijavljena na ovaj turnir.");
    if (entry.status === "REGISTERED") return;
    await tx.tournamentTeam.update({where: {tournament_id_team_id: {tournament_id: tournamentId, team_id: teamId}}, data: {status: "REGISTERED"}});
    if (t.max_teams != null) await tx.tournament.update({where: {tournament_id: tournamentId}, data: {max_teams: t.max_teams + 1}});
  });
}

// Prijave otvorene / zatvorene. Before the start, opening them again drops a Kolo 1 draft: it is made once the teams
// are final. On a tournament with Otvorene prijave the switch works while it is played too, and then changes nothing
// but the switch — the Kolos already made stay as they are.
export async function setRegistrationsOpen(tournamentId: number, open: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockTournament(tx, tournamentId);
    const t = await tx.tournament.findUnique({where: {tournament_id: tournamentId}});
    if (!t) throw new NotFoundError(TOURNAMENT_NOT_FOUND);
    if (t.cancelled_at) throw new InvalidResultError("Turnir je otkazan.");
    // a started tournament may keep its sign-ups open only with Otvorene prijave (Tournament_started_check)
    if (t.started_at && !t.open_signups) throw new InvalidResultError(TOURNAMENT_STARTED);
    if (open && !t.started_at) await dropDrafts(tx, tournamentId);
    await tx.tournament.update({where: {tournament_id: tournamentId}, data: {registrations_open: open}});
  });
}

// Dodaj ekipu's search: teams by their name or a player's name or username, with why one can't be added
export async function candidateTeams(tournamentId: number, query: string): Promise<CandidateTeam[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [teams, entries] = await Promise.all([
    prisma.team.findMany({
      where: {
        team_id: {not: BYE_TEAM_ID},
        tournamentTeams: {none: {tournament_id: tournamentId}},
        OR: [
          {team_name: {contains: q, mode: "insensitive"}},
          {teamPlayers: {some: {player: {OR: [{username: {contains: q, mode: "insensitive"}}, {first_name: {contains: q, mode: "insensitive"}}, {last_name: {contains: q, mode: "insensitive"}}]}}}},
        ],
      },
      orderBy: {team_name: "asc"},
      take: 30,
      select: {team_id: true, team_name: true, teamPlayers: {select: {player: {select: {id: true, first_name: true, last_name: true, username: true, active: true, deleted_at: true}}}}},
    }),
    prisma.tournamentTeam.findMany({where: {tournament_id: tournamentId}, select: {team_id: true, team: {select: {team_name: true, teamPlayers: {select: {player_id: true}}}}}}),
  ]);
  const others = entries.map((e) => ({teamId: e.team_id, playerIds: e.team.teamPlayers.map((tp) => tp.player_id)}));
  const shown = teams.slice(0, 12);
  const bans = await activeBans({teamIds: shown.map((t) => t.team_id), playerIds: shown.flatMap((t) => t.teamPlayers.map((tp) => tp.player.id))});
  return shown.map((t) => {
    const players = t.teamPlayers.map((tp) => tp.player).filter((p) => p.deleted_at == null);
    const taken = playersInOtherEntries(players.map((p) => p.id), others);
    // Zabrana prijava: the team's own ban, or a player's
    const ban = bans.teams.get(t.team_id) ?? players.map((p) => bans.players.get(p.id)).find((b) => b != null) ?? null;
    const reason = ban
      ? ban.until
        ? `Zabrana prijava do ${banDay(ban.until)}`
        : "Trajna zabrana prijava"
      : players.filter((p) => p.active).length < 2
        ? TEAM_NEEDS_TWO
        : taken.length > 0
          ? `${displayName(players.find((p) => p.id === taken[0])!)} je već prijavljen.`
          : null;
    return {
      team_id: t.team_id,
      team_name: t.team_name,
      players: players.map((p) => ({id: p.id, name: displayName(p), photo_url: null, username: p.username})),
      reason,
      banned: ban != null,
      ban_until: ban ? ban.until : null,
    };
  });
}
