import {prisma} from "@/app/_lib/prisma";
import {isByeTeam} from "@/app/_lib/bye";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {TEAM_DELETE_PLAYED, TEAM_NOT_FOUND} from "@/app/_interfaces/team";

/**
 * "Obriši ekipu" (admin): only a team that has never sat at a table. Every row that points at a team is deleted with
 * it (onDelete: Cascade), and a table is also its opponent's result and both teams' ratings, so a team that has played
 * stays. Its players, league entries, photo and substitute ads go with it; a Novo kolo draft forgets it.
 * A missing team (or the bye) is a 404 (NotFoundError), a team that can't be deleted a 400 with the reason.
 */
export async function deleteTeam(teamId: number): Promise<void> {
  if (isByeTeam(teamId)) throw new NotFoundError(TEAM_NOT_FOUND);
  await prisma.$transaction(async (tx) => {
    // the row's lock: a table being made for the team waits for this and then fails (its team is gone), or has already
    // been made and is counted below
    const locked = await tx.$queryRaw<{team_id: number}[]>`SELECT team_id FROM "Team" WHERE team_id = ${teamId} FOR UPDATE`;
    if (!locked.length) throw new NotFoundError(TEAM_NOT_FOUND);
    const tables = await tx.round.count({where: {OR: [{team1_id: teamId}, {team2_id: teamId}]}});
    if (tables) throw new InvalidResultError(TEAM_DELETE_PLAYED);
    await tx.$executeRaw`UPDATE "CreateRoundDraft" SET sitting_out = array_remove(sitting_out, ${teamId}::int) WHERE ${teamId}::int = ANY(sitting_out)`;
    await tx.team.delete({where: {team_id: teamId}});
  });
}
