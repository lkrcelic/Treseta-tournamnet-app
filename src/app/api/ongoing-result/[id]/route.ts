import {getOngoingResult} from "@/app/_lib/service/ongoingResult/getOne";
import {ResultCreateRequestValidation, ResultResponseValidation} from "@/app/_interfaces/result";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {updateOngoingResult} from "@/app/_lib/service/ongoingResult/update";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {getRoundIdOfOngoingResult} from "@/app/_lib/service/ongoingMatch/getRoundId";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

// A new response each time: a response body can only be sent once
const resultNotFound = () => NextResponse.json({error: "Igra ne postoji."}, {status: STATUS.NotFound});

export async function GET(request: NextRequest, {params}: { params: { id: string } }): Promise<Response> {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const resultId = Number(params.id);
    // an id the database can't hold (also a malformed one) doesn't exist either
    if (!isDbId(resultId)) return resultNotFound();

    try {
        const dbOngoingResult = await getOngoingResult(resultId);
        if (!dbOngoingResult) {
            return resultNotFound();
        }

        const ongoingResult = ResultResponseValidation.parse(dbOngoingResult);

        return NextResponse.json(ongoingResult, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Igra se nije učitala.");
    }
}

export async function PUT(request: NextRequest, {params}: { params: { id: string } }): Promise<NextResponse> {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const resultId = Number(params.id);
    if (!isDbId(resultId)) return resultNotFound();

    try {
        const req_data = await request.json();
        const resultData = ResultCreateRequestValidation.parse(req_data);

        if (!(await canPlayRound(auth.user, await getRoundIdOfOngoingResult(resultId)))) {
            return notYourRoundResponse();
        }

        await updateOngoingResult({result_id: resultId, resultData: resultData});

        return NextResponse.json({message: "Igra je spremljena."}, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Igra nije spremljena.");
    }
}
