import { NextRequest, NextResponse } from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import leagueService from "@/app/_lib/service/league";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
    const {id} = params;
    
    try {
        const dates = await leagueService.getRoundDatesByLeagueId(Number(id));

        return NextResponse.json(dates, {status: STATUS.OK});
      } catch (error) {
        console.log(error);
        return NextResponse.json({error: "Failed to fetch round dates."}, {status: STATUS.ServerError});
      }
    
}