import {NextRequest, NextResponse} from "next/server";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getRoundById as getRoundbyId} from "@/app/_lib/service/round/getById";
import {getNewestOngoingMatchByRoundId} from "@/app/_lib/service/match/getNewstByRoundId";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;

    try {
        const round = await getRoundbyId(Number(id))
        // the match being played in this round right now, if any
        const ongoingMatch = await getNewestOngoingMatchByRoundId(round.id);

        return NextResponse.json({...round, ongoing_match_id: ongoingMatch?.id ?? null}, {status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: "Failed to fetch round."}, {status: STATUS.ServerError});
    }
}
