import {CreateOngoingMatchRequestValidation} from "@/app/_interfaces/match";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";

export async function POST(request: NextRequest) {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    try {
        const req_data = await request.json();
        const createRequest = CreateOngoingMatchRequestValidation.parse(req_data);

        if (!(await canPlayRound(auth.user, createRequest.round_id))) {
            return notYourRoundResponse();
        }

        const ongoingMatch = await createOngoingMatch(createRequest);

        return NextResponse.json({message: "Ongoing match successfully created", id: ongoingMatch.id}, {status: STATUS.OK});
    } catch (error) {
        return errorResponse(error, "Failed to start the match.");
    }
}
