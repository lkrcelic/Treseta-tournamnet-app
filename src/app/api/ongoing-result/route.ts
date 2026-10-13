import {ResultCreateRequestValidation} from "@/app/_interfaces/result";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {createResult} from "@/app/_lib/service/ongoingResult/create";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {getRoundIdOfOngoingMatch} from "@/app/_lib/service/ongoingMatch/getRoundId";
import {errorResponse} from "@/app/_lib/apiErrors";

export async function POST(request: NextRequest) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    try {
        const req_data = await request.json();
        const resultData = ResultCreateRequestValidation.parse(req_data);

        if (!(await canPlayRound(auth.user, await getRoundIdOfOngoingMatch(resultData.match_id)))) {
            return notYourRoundResponse();
        }

        const resultId = await createResult(resultData);

        return NextResponse.json({message: "Igra je spremljena.", result_id: resultId}, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Igra nije spremljena.");
    }
}
