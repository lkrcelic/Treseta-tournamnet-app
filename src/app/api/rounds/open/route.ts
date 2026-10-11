import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLastOpenRoundByPlayerId} from "@/app/_lib/service/round/getLastOpenByPlayerId";
import {getNewestOngoingMatchByRoundId} from "@/app/_lib/service/match/getNewstByRoundId";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {hasLineup} from "@/app/_lib/service/round/lineup";
import {getRoundConferences} from "@/app/_lib/service/league/conferences";

// The round the logged-in player should play now, and its running match if one is started (with its score, team1
// first, for the Continue Game card on Home). hasLineup: who plays it is confirmed, so Start Game can skip that step.
// conferences: the two teams' conferences, team1 first, for the dots on the card (null when the league has none).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const round = await getLastOpenRoundByPlayerId(auth.user.id);
    if (!round) {
      return NextResponse.json({error: "Trenutno nemaš otvorenu rundu."}, {status: STATUS.NotFound});
    }

    const [ongoingMatch, lineup, conferences] = await Promise.all([
      getNewestOngoingMatchByRoundId(round.id),
      hasLineup(round.id),
      getRoundConferences(round.id, round.team1_id, round.team2_id),
    ]);

    return NextResponse.json({
      roundId: round.id,
      ongoingMatchId: ongoingMatch?.id || null,
      hasLineup: lineup,
      ongoingScore: ongoingMatch ? [ongoingMatch.player_pair1_score ?? 0, ongoingMatch.player_pair2_score ?? 0] : null,
      conferences,
    }, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: 'Failed to get open round'}, {status: STATUS.ServerError});
  }
}
