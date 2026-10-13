import {NextRequest, NextResponse} from "next/server";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getRoundById as getRoundbyId} from "@/app/_lib/service/round/getById";
import {getNewestOngoingMatchByRoundId} from "@/app/_lib/service/match/getNewstByRoundId";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";

// A table with its teams; a round that isn't published yet is only for admins (anyone else: 404)
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;

    try {
        const round = await getRoundbyId(Number(id), isAdmin(auth.user))
        // the match being played in this round right now, if any
        const ongoingMatch = await getNewestOngoingMatchByRoundId(round.id);

        return NextResponse.json({...round, ongoing_match_id: ongoingMatch?.id ?? null}, {status: STATUS.OK});
    } catch (error) {
        // a round that doesn't exist is a 404 with "Runda ne postoji."
        return lookupErrorResponse(error, "Runda se nije učitala.");
    }
}
