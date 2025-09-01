// src/app/api/ongoing-bela-result/route.ts

import {BelaResultCreateRequestValidation} from "@/app/_interfaces/belaResult";
import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {incrementOngoingMatchScore} from "@/app/_lib/service/ongoingMatch/update";
import {createBelaResult} from "@/app/_lib/service/ongoingBelaResult/create";


export async function POST(request: Request) {
    try {
        const req_data = await request.json();
        const resultData = BelaResultCreateRequestValidation.parse(req_data);
        await createBelaResult(resultData);
        await incrementOngoingMatchScore(resultData);

        return NextResponse.json({message: "Result successfully created"},{status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: error}, {status: STATUS.ServerError});
    }
}
