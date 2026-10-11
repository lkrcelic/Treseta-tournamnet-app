import {Prisma} from "@prisma/client";
import {prisma} from "@/app/_lib/prisma";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {SmokingRound, smokingRecords, SmokingSetup} from "@/app/_lib/matching/smokingTables";
import {SmokingPlan, SmokingPlanSide, SmokingPlanTeam} from "@/app/_interfaces/smoking";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {teamSmokers} from "@/app/_lib/service/team/smokers";

// Smoking tables on the database side: the league's season as the rotation reads it, and the plan admins see in
// Create Round

type Db = Prisma.TransactionClient | typeof prisma;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const roundSelect = {
  round_date: true,
  round_number: true,
  table_number: true,
  team1_id: true,
  team2_id: true,
  team1_smokers: true,
  team2_smokers: true,
  smoking_table: true,
} as const;

type RoundRow = Prisma.RoundGetPayload<{select: typeof roundSelect}>;

const toSmokingRound = (r: RoundRow): SmokingRound => ({
  date: isoDate(r.round_date!),
  roundNumber: r.round_number,
  team1Id: r.team1_id,
  team2Id: r.team2_id,
  team1Smokers: r.team1_smokers,
  team2Smokers: r.team2_smokers,
  smoking: r.smoking_table,
});

// The league's tables up to tonight
async function seasonRounds(leagueId: number, today: string, db: Db): Promise<RoundRow[]> {
  return db.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: {not: null, lte: new Date(`${today}T00:00:00.000Z`)}},
    select: roundSelect,
  });
}

// What Create Round seats tonight's new rounds with: the smoking tables, the teams' smokers and the season so far
export async function smokingSetup(leagueId: number, tables: number[], smokers: Map<number, number>, db: Db = prisma): Promise<SmokingSetup> {
  const today = leagueDateString();
  const rounds = await seasonRounds(leagueId, today, db);
  return {tables, smokers, records: smokingRecords(rounds.map(toSmokingRound), today)};
}

// Tonight's smoking tables round by round, and every smoking team's rotation this season (admin)
export async function smokingPlan(leagueId: number): Promise<SmokingPlan> {
  const league = await prisma.league.findUnique({
    where: {league_id: leagueId},
    select: {
      smoking_tables: true,
      leagueTeams: {where: {team_id: {not: BYE_TEAM_ID}}, select: {team: {select: {team_id: true, team_name: true}}}},
    },
  });
  if (!league) throw new NotFoundError("League not found.");

  const today = leagueDateString();
  const teams = league.leagueTeams.map((lt) => lt.team);
  const [smokers, rounds] = await Promise.all([teamSmokers(teams.map((t) => t.team_id)), seasonRounds(leagueId, today, prisma)]);
  const records = smokingRecords(rounds.map(toSmokingRound), today);
  const names = new Map(teams.map((t) => [t.team_id, t.team_name]));

  const tonight = rounds.filter((r) => isoDate(r.round_date!) === today && r.round_number != null);
  const roundNumbers = Array.from(new Set(tonight.map((r) => r.round_number!))).sort((a, b) => a - b);
  // a team removed from the league can still have a table tonight
  const missing = tonight.flatMap((r) => [r.team1_id, r.team2_id]).filter((id) => !isByeTeam(id) && !names.has(id));
  if (missing.length) {
    const extra = await prisma.team.findMany({where: {team_id: {in: missing}}, select: {team_id: true, team_name: true}});
    extra.forEach((t) => names.set(t.team_id, t.team_name));
  }
  const side = (id: number, smokers: number): SmokingPlanSide => ({id, name: names.get(id) ?? `Team ${id}`, smokers});

  const playedRounds = new Map<number, number>();
  rounds.forEach((r) => {
    if (isByeTeam(r.team1_id) || isByeTeam(r.team2_id)) return;
    [r.team1_id, r.team2_id].forEach((id) => playedRounds.set(id, (playedRounds.get(id) ?? 0) + 1));
  });

  const rotation: SmokingPlanTeam[] = teams
    .map((t) => {
      const record = records.get(t.team_id);
      return {
        id: t.team_id,
        name: t.team_name,
        smokers: smokers.get(t.team_id) ?? 0,
        tonight: roundNumbers.map((n) => {
          const table = tonight.find((r) => r.round_number === n && (r.team1_id === t.team_id || r.team2_id === t.team_id));
          return table && !isByeTeam(table.team1_id) && !isByeTeam(table.team2_id) ? table.smoking_table : null;
        }),
        smokingRounds: record?.smokingRounds ?? 0,
        rounds: playedRounds.get(t.team_id) ?? 0,
        fairShare: Math.round((record?.fairShare ?? 0) * 10) / 10,
        missedNights: record?.missedNights ?? 0,
      };
    })
    .filter((t) => t.smokers > 0 || t.smokingRounds > 0 || t.missedNights > 0)
    .sort((a, b) => b.smokers - a.smokers || a.name.localeCompare(b.name, "hr"));

  return {
    date: today,
    tables: league.smoking_tables,
    roundNumbers,
    rounds: roundNumbers.map((n) => ({
      roundNumber: n,
      tables: tonight
        .filter((r) => r.round_number === n && r.smoking_table)
        .sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0))
        .map((r) => ({table: r.table_number ?? 0, teams: [side(r.team1_id, r.team1_smokers), side(r.team2_id, r.team2_smokers)] as [SmokingPlanSide, SmokingPlanSide]})),
    })),
    teams: rotation,
  };
}
