import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLineup, LineupSaveValidation, saveLineup} from "@/app/_lib/service/round/lineup";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";

// Who plays the round: the saved lineup, or the suggested one (last round's players, or the founders)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const roundId = Number(params.id);
    if (!(await canPlayRound(auth.user, roundId))) return notYourRoundResponse();

    return NextResponse.json(await getLineup(roundId, auth.user.id), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to load the lineup.");
  }
}

// Confirms the lineup (Potvrdi i počni); a player of either team, or an admin, can set it
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const roundId = Number(params.id);
    if (!(await canPlayRound(auth.user, roundId))) return notYourRoundResponse();

    await saveLineup(roundId, LineupSaveValidation.parse(await request.json()));
    return NextResponse.json({message: "Lineup saved"}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to save the lineup.");
  }
}
