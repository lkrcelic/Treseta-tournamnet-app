import {CreateOngoingMatchRequestValidation} from "@/app/_interfaces/match";
import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {createOngoingMatch} from "@/app/_lib/service/ongoingMatch/create";

export async function POST(request: Request) {
    try {
        const req_data = await request.json();
        const createRequest = CreateOngoingMatchRequestValidation.parse(req_data);

       const ongoingMatch = await createOngoingMatch(createRequest);

        return NextResponse.json({message: "Ongoing match successfully created", id: ongoingMatch.id}, {status: STATUS.OK});
    } catch (error) {
        console.log(error);
        return NextResponse.json({error: error}, {status: STATUS.ServerError});
    }
}