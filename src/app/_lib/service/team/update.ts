import {prisma} from "@/app/_lib/prisma";
import {Team} from "@prisma/client";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {isByeTeam} from "@/app/_lib/bye";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";

// Team names are unique ignoring case ("Lavovi" and "lavovi" would be the same team in a standings table)
export async function teamNameTaken(name: string, exceptTeamId?: number): Promise<boolean> {
  const other = await prisma.team.findFirst({
    where: {
      team_name: anyCase(name.trim()),
      ...(exceptTeamId != null ? {team_id: {not: exceptTeamId}} : {}),
    },
    select: {team_id: true},
  });
  return other !== null;
}

export async function teamExists(teamId: number): Promise<boolean> {
  return (await prisma.team.count({where: {team_id: teamId}})) > 0;
}

// null when the team doesn't exist
export async function renameTeam(teamId: number, name: string): Promise<Team | null> {
  if (!(await teamExists(teamId))) return null;
  if (isByeTeam(teamId)) throw new InvalidResultError("Slobodna runda se ne može mijenjati.");
  if (await teamNameTaken(name, teamId)) {
    throw new InvalidResultError("Ekipa s tim imenom već postoji.");
  }
  return prisma.team.update({where: {team_id: teamId}, data: {team_name: name.trim()}});
}
