import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getOneRound} from "@/app/_lib/service/round/getOne";

export async function GET(request: Request, {params}: { params: { id: string } }) {
    const {id} = params;

    try {
        const round = await getOneRound(Number(id))

        return NextResponse.json(round, {status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: "Failed to fetch round."}, {status: STATUS.BadRequest});
    }
}
