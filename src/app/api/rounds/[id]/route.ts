import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import roundService from "@/app/_lib/service/round";

export async function GET(request: Request, {params}: { params: { id: string } }) {
    const {id} = params;

    try {
        const round = await roundService.getRoundById(Number(id))

        return NextResponse.json(round, {status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: "Failed to fetch round."}, {status: STATUS.BadRequest});
    }
}
