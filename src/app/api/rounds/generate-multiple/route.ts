import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {generateGroupedRoundPairings, generateMultipleRoundPairings} from "@/app/_lib/matching/multipleRoundMatching";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {REPEAT_MATCHUPS, RoundCreateRequestValidation} from "@/app/_interfaces/round";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {insertRoundBatch, pairsPlayedToday} from "@/app/_lib/service/round/insertPairRounds";
import {errorResponse} from "@/app/_lib/apiErrors";
import {conferenceGroups, conferenceLookup} from "@/app/_lib/conferences";
import {getLeagueConferences} from "@/app/_lib/service/league/conferences";
import {seatRounds} from "@/app/_lib/matching/smokingTables";
import {smokingSetup} from "@/app/_lib/service/round/smoking";
import {teamSmokers} from "@/app/_lib/service/team/smokers";

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

    // the pairing rejects impossible settings (odd window, more rounds than teams, too few teams in a conference, ...)
    // with an InvalidResultError: a 400
    const playedToday = await pairsPlayedToday(league_id);
    const options = {windowSize, numberOfRounds, playedToday};
    const plan = conferences?.conferences.length
      ? generateGroupedRoundPairings(conferenceGroups(filteredTeams, conferences), options)
      : generateMultipleRoundPairings(filteredTeams, options);

    // the admin decides: create them anyway, or try again with a bigger window
    if (plan.repeats.length > 0 && !parsed.allowRepeats) {
      return NextResponse.json(
        {
          error: "Neke ekipe bi se večeras srele dvaput.",
          code: REPEAT_MATCHUPS,
          repeats: plan.repeats.map((p) => [p.teamOne.name, p.teamTwo.name]),
        },
        {status: STATUS.Conflict}
      );
    }

    // smoking tables only decide where a pair sits; a page from before them sends none and keeps the league's ones
    const smokingTables = parsed.smoking_tables;
    const smokers = await teamSmokers(filteredTeams.map((t) => t.id));
    const setup = smokingTables?.length ? await smokingSetup(league_id, smokingTables, smokers) : null;
    const seated = seatRounds(plan.rounds, setup);

    // drafts until an admin publishes them (Upravljanje ligom · Skica)
    const {firstRoundNumber, date, alreadyCreated} = await insertRoundBatch(seated, league_id, {smokers, tables: smokingTables});

    return NextResponse.json(
      {round_number: firstRoundNumber, date, already_created: alreadyCreated},
      {status: alreadyCreated ? STATUS.OK : STATUS.Created}
    );
  } catch (error) {
    return errorResponse(error, "Kolo nije napravljeno.");
  }
}
