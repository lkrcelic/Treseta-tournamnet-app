import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getOngoingMatchWithResults} from "@/app/_lib/service/ongoingMatch/getOneWithResults";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;

    try {
        const ongoingMatch = await getOngoingMatchWithResults(Number(id));

        return NextResponse.json(ongoingMatch, {status: STATUS.OK});
    } catch (error) {
        // a finished match is gone (NotFoundError → 404, not logged), which phones following it check for regularly
        return lookupErrorResponse(error, "Meč se nije učitao.");
    }
}
