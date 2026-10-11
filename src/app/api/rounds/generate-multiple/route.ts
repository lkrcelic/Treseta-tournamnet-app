import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {generateMultipleRoundPairings, RoundsPlan} from "@/app/_lib/matching/multipleRoundMatching";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {PAIRING_NOTICE, RoundCreateRequestValidation, SameConferencePair} from "@/app/_interfaces/round";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {insertRoundBatch, pairsPlayedToday} from "@/app/_lib/service/round/insertPairRounds";
import {errorResponse} from "@/app/_lib/apiErrors";
import {conferenceLookup, sameConferencePairs} from "@/app/_lib/conferences";
import {getLeagueConferences} from "@/app/_lib/service/league/conferences";

// the pairing stops searching after a few seconds; this leaves room for the database around it
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const parsed = RoundCreateRequestValidation.parse(body);
    const {league_id, present_teams} = parsed;
    const numberOfRounds = parsed.numberOfRounds ?? 3;
    const windowSize = parsed.windowSize ?? 8;

    const teamsWithScores = await getLeagueTeamsWithScores(league_id);
    const filteredTeams = teamsWithScores.filter((team) => present_teams.includes(team.id));

    let plan: RoundsPlan;
    try {
      const playedToday = await pairsPlayedToday(league_id);
      plan = generateMultipleRoundPairings(filteredTeams, {windowSize, numberOfRounds, playedToday});
    } catch (error) {
      // the pairing rejects impossible settings (odd window, more rounds than teams, ...)
      return NextResponse.json({error: (error as Error).message}, {status: STATUS.BadRequest});
    }

    // the admin decides: create them anyway, or (for repeats) try again with a bigger window
    const repeats = parsed.allowRepeats ? [] : plan.repeats;
    const sameConference = parsed.allowSameConference
      ? []
      : sameConferencePairs(plan.rounds, conferenceLookup(await getLeagueConferences(league_id)).of);
    if (repeats.length > 0 || sameConference.length > 0) {
      return NextResponse.json(
        {
          error: repeats.length > 0 ? "Some teams will play twice today" : "Some tables have two teams of the same conference",
          code: PAIRING_NOTICE,
          repeats: repeats.map((p) => [p.teamOne.name, p.teamTwo.name]),
          same_conference: sameConference.map(
            (p): SameConferencePair => ({teams: [p.teamOne.name, p.teamTwo.name], conference: {name: p.conference.name, color: p.conference.color}})
          ),
        },
        {status: STATUS.Conflict}
      );
    }

    const {firstRoundNumber, alreadyCreated} = await insertRoundBatch(plan.rounds, league_id);

    return NextResponse.json(
      {round_number: firstRoundNumber, already_created: alreadyCreated},
      {status: alreadyCreated ? STATUS.OK : STATUS.Created}
    );
  } catch (error) {
    return errorResponse(error, "Failed to create rounds.");
  }
}
