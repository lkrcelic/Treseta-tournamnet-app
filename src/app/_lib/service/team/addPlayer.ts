import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {isByeTeam} from "@/app/_lib/bye";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {PLAYER_DEACTIVATED, PLAYER_NOT_FOUND} from "@/app/_interfaces/player";
import {lockRatings} from "@/app/_lib/service/admin/recalc";
import {freezeRosterLineups} from "./freezeLineups";

// Adds a player to a team (admin). Only an active player can join; a deleted one doesn't exist any more. The team's
// finished rounds keep the roster they were rated with (freezeRosterLineups), so the newcomer's arrival doesn't move
// anyone's rating. Adding someone who is already in the team changes nothing (also when they were deactivated since).
export async function addPlayerToTeam(team_id: number, player_id: number) {
  if (isByeTeam(team_id)) throw new InvalidResultError("Slobodna runda nema igrača.");
  if (!isDbId(team_id)) throw new InvalidResultError("Ekipa ne postoji.");
  if (!isDbId(player_id)) throw new InvalidResultError(PLAYER_NOT_FOUND);

  return prisma.$transaction(
    async (tx) => {
      // read after the lock: deleting a player (anonymisePlayer) holds it too, so a player deleted while this waited
      // isn't added afterwards
      await lockRatings(tx);
      if (!(await tx.team.count({where: {team_id}}))) throw new InvalidResultError("Ekipa ne postoji.");
      const player = await tx.player.findUnique({where: {id: player_id}, select: {active: true, deleted_at: true}});
      if (!player || player.deleted_at) throw new InvalidResultError(PLAYER_NOT_FOUND);
      const member = await tx.teamPlayer.findUnique({where: {team_id_player_id: {team_id, player_id}}});
      if (member) return member;
      if (!player.active) throw new InvalidResultError(PLAYER_DEACTIVATED);

      await freezeRosterLineups(tx, [team_id]);
      return tx.teamPlayer.create({data: {team_id, player_id}});
    },
    {timeout: 20_000}
  );
}

// Takes a player out of the team (admin). The founder columns keep who founded it, and the team's finished rounds
// keep counting for the player (freezeRosterLineups). Returns false when they weren't in it.
export async function removePlayerFromTeam(team_id: number, player_id: number): Promise<boolean> {
  if (!isDbId(team_id) || !isDbId(player_id)) return false;
  return prisma.$transaction(
    async (tx) => {
      await lockRatings(tx);
      const member = await tx.teamPlayer.findUnique({where: {team_id_player_id: {team_id, player_id}}});
      if (!member) return false;
      await freezeRosterLineups(tx, [team_id]);
      await tx.teamPlayer.delete({where: {team_id_player_id: {team_id, player_id}}});
      return true;
    },
    {timeout: 20_000}
  );
}
