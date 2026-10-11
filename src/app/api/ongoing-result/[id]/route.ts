import {getOngoingResult} from "@/app/_lib/service/ongoingResult/getOne";
import {ResultCreateRequestValidation, ResultResponseValidation} from "@/app/_interfaces/result";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {getRoundIdOfOngoingResult} from "@/app/_lib/service/ongoingMatch/getRoundId";
import {errorResponse} from "@/app/_lib/apiErrors";

export async function GET(request: NextRequest, {params}: { params: { id: string } }): Promise<Response> {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;

    try {
        const dbOngoingResult = await getOngoingResult(Number(id));
        if (!dbOngoingResult) {
            return NextResponse.json({error: "Hand not found."}, {status: STATUS.NotFound});
        }

        const ongoingResult = ResultResponseValidation.parse(dbOngoingResult);

        return NextResponse.json(ongoingResult, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Failed to fetch the hand.");
    }
}

export async function PUT(request: NextRequest, {params}: { params: { id: string } }): Promise<NextResponse> {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const resultId = Number(params.id);

    try {
        const req_data = await request.json();
        const resultData = ResultCreateRequestValidation.parse(req_data);

        if (!(await canPlayRound(auth.user, await getRoundIdOfOngoingResult(resultId)))) {
            return notYourRoundResponse();
        }

        await updateOngoingResult({result_id: resultId, resultData: resultData});

        return NextResponse.json({message: "Result successfully updated"}, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Failed to update the hand.");
    }
}
