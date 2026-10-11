import {requireUser} from "@/app/_lib/service/auth/requireUser";
import { NextRequest, NextResponse } from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import { getRoundDatesByLeagueId } from "@/app/_lib/service/league/getRoundDatesById";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    // nights and round tables need a login; only the season table (/standings) is public
    const auth = await requireUser(request);
    if (auth.response) return auth.response;
    const {id} = params;
    
    try {
        const dates = await getRoundDatesByLeagueId(Number(id));

        return NextResponse.json(dates, {status: STATUS.OK});
      } catch (error) {
        console.log(error);
        return NextResponse.json({error: "Failed to fetch round dates."}, {status: STATUS.ServerError});
      }
    
}