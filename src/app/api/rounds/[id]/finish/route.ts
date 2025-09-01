import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {finishRound} from "@/app/_lib/service/round/finish";

export async function POST(request: Request, {params}: { params: { id: string } }) {
  const {id} = params;

  try {
    await finishRound(Number(id))

    return NextResponse.json("Round finished", {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Failed to fetch round."}, {status: STATUS.BadRequest});
  }
}
