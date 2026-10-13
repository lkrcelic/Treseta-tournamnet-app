import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {generateGroupedRoundPairings, generateMultipleRoundPairings, RoundsPlan} from "@/app/_lib/matching/multipleRoundMatching";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {REPEAT_MATCHUPS, RoundCreateRequestValidation} from "@/app/_interfaces/round";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {insertRoundBatch, pairsPlayedToday} from "@/app/_lib/service/round/insertPairRounds";
import {errorResponse} from "@/app/_lib/apiErrors";
import {conferenceGroups, conferenceLookup} from "@/app/_lib/conferences";
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

    // "Only within conferences": every conference is paired on its own (a league without conferences ignores it)
    const conferences = parsed.withinConferences ? conferenceLookup(await getLeagueConferences(league_id)) : null;

    let plan: RoundsPlan;
    try {
      const playedToday = await pairsPlayedToday(league_id);
      const options = {windowSize, numberOfRounds, playedToday};
      plan = conferences?.conferences.length
        ? generateGroupedRoundPairings(conferenceGroups(filteredTeams, conferences), options)
        : generateMultipleRoundPairings(filteredTeams, options);
    } catch (error) {
      // the pairing rejects impossible settings (odd window, more rounds than teams, ...)
      return NextResponse.json({error: (error as Error).message}, {status: STATUS.BadRequest});
    }

    // the admin decides: create them anyway, or try again with a bigger window
    if (plan.repeats.length > 0 && !parsed.allowRepeats) {
      return NextResponse.json(
        {
          error: "Some teams will play twice today",
          code: REPEAT_MATCHUPS,
          repeats: plan.repeats.map((p) => [p.teamOne.name, p.teamTwo.name]),
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
