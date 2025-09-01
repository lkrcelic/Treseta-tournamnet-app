import {getAuthorizedUser} from "@/app/_lib/auth";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);

    return NextResponse.json(user.player_role === "ADMIN", {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Error"}, {status: STATUS.ServerError});
  }
}