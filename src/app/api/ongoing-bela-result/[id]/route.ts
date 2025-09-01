import {getBelaResultWithAnnouncements} from "@/app/_lib/service/ongoingBelaResult/getOneWithAnnouncements";
import {BelaResultCreateRequestValidation, BelaResultResponseValidation} from "@/app/_interfaces/belaResult";
import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {updateOngoingMatchScore} from "@/app/_lib/service/ongoingMatch/update";
import {updateOngoingBelaResult} from "@/app/_lib/service/ongoingBelaResult/update";

export async function GET(request: Request, {params}: { params: { id: string } }): Promise<Response> {
    const {id} = params;

    try {
        const dbOngoingBelaResult = await getBelaResultWithAnnouncements(Number(id));

        const ongoingBelaResult = BelaResultResponseValidation.parse(dbOngoingBelaResult);

        return NextResponse.json(ongoingBelaResult, {status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: "Failed to fetch ongoing bela result."}, {status: STATUS.BadRequest});
    }
}

export async function PUT(request: Request, {params}: { params: { id: string } }): Promise<NextResponse> {
    const {id} = params;

    try {
        const req_data = await request.json();
        const resultData = BelaResultCreateRequestValidation.parse(req_data);

        await updateOngoingMatchScore({result_id: Number(id), resultData: resultData});
        await updateOngoingBelaResult({result_id: Number(id), resultData: resultData});

        return NextResponse.json({message: "Result successfully created"},{status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: error}, {status: STATUS.ServerError});
    }
}