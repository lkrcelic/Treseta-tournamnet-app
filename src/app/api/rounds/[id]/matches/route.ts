import {NextRequest, NextResponse} from "next/server";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAllMatchesByRoundId} from "@/app/_lib/service/match/getAllByRoundId";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const {id} = params;

  try {
    const round = await getAllMatchesByRoundId(Number(id))

    return NextResponse.json(round, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Failed to round matches."}, {status: STATUS.BadRequest});
  }
}
