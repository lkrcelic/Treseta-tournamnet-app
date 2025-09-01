import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {extractPlayersSeatingOrder} from "@/app/_lib/service/ongoingMatch/extractPlayersSeatingOrder";
import {OngoingMatchResponseValidation} from "@/app/_interfaces/match";
import {getOngoingMatchWithResultsAndPlayers} from "@/app/_lib/service/ongoingMatch/getOneWithResultsAndPlayers";

export async function GET(request: Request, {params}: { params: { id: string } }) {
    const {id} = params;

    try {
        const dbOngoingMatch = await getOngoingMatchWithResultsAndPlayers(Number(id));
        const seatingOrder = await extractPlayersSeatingOrder(dbOngoingMatch);

        const ongoingMatch = OngoingMatchResponseValidation.parse(dbOngoingMatch);
        ongoingMatch.seating_order = seatingOrder;

        return NextResponse.json(ongoingMatch, {status: STATUS.OK});
    } catch (error) {
        console.error(error);
        return NextResponse.json({error: "Failed to fetch ongoing match."}, {status: STATUS.BadRequest});
    }
}
