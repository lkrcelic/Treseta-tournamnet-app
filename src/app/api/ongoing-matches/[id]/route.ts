import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getOngoingMatchWithResults} from "@/app/_lib/service/ongoingMatch/getOneWithResults";
import {requireUser} from "@/app/_lib/service/auth/requireUser";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;

    try {
        const ongoingMatch = await getOngoingMatchWithResults(Number(id));

        return NextResponse.json(ongoingMatch, {status: STATUS.OK});
    } catch (error) {
        // a finished match is gone, which phones following it check for regularly, so that isn't logged
        if (!(error instanceof Error && error.message === "Ongoing match not found.")) console.error(error);
        return NextResponse.json({error: "Failed to fetch ongoing match."}, {status: STATUS.NotFound});
    }
}
