import {prisma} from "@/app/_lib/prisma";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {isByeTeam} from "@/app/_lib/bye";

export async function addPlayerToTeam(team_id: number, player_id: number) {
  const [team, player] = await Promise.all([
    prisma.team.count({where: {team_id}}),
    prisma.player.count({where: {id: player_id}}),
  ]);
  if (!team) throw new InvalidResultError("Ekipa ne postoji.");
  if (isByeTeam(team_id)) throw new InvalidResultError("Slobodna runda nema igrača.");
  if (!player) throw new InvalidResultError("Igrač ne postoji.");

  // idempotent: adding a player who is already in the team changes nothing
  return prisma.teamPlayer.upsert({
    where: {team_id_player_id: {team_id, player_id}},
    create: {team_id, player_id},
    update: {},
  });
}

// Takes a player out of the team. The founder columns keep who founded it. Returns false when they weren't in it.
export async function removePlayerFromTeam(team_id: number, player_id: number): Promise<boolean> {
  const {count} = await prisma.teamPlayer.deleteMany({where: {team_id, player_id}});
  return count > 0;
}
