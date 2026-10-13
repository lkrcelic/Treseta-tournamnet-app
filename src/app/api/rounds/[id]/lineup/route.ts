import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLineup, LineupSaveValidation, ROUND_FINISHED, saveLineup} from "@/app/_lib/service/round/lineup";
import {canPlayRound, notYourRoundResponse, requireUser} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

// an id the database can't hold (also a malformed one) doesn't exist either
const roundNotFound = () => NextResponse.json({error: "Runda ne postoji."}, {status: STATUS.NotFound});

// Who plays the round: the saved lineup, or the suggested one (last round's players, or the founders). For the players
// of the round while it is open (it lists both teams' usernames); a finished round's for admins only.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const roundId = Number(params.id);
    if (!isDbId(roundId)) return roundNotFound();
    if (!(await canPlayRound(auth.user, roundId))) return notYourRoundResponse();

    const lineup = await getLineup(roundId, auth.user);
    if (lineup === "finished") return NextResponse.json({error: ROUND_FINISHED}, {status: STATUS.Forbidden});
    return NextResponse.json(lineup, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Postava se nije učitala.");
  }
}

// Confirms the lineup (Potvrdi i počni); a player of either team, or an admin, can set it
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const roundId = Number(params.id);
    if (!isDbId(roundId)) return roundNotFound();
    if (!(await canPlayRound(auth.user, roundId))) return notYourRoundResponse();

    await saveLineup(roundId, LineupSaveValidation.parse(await request.json()));
    return NextResponse.json({message: "Postava je spremljena."}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Postava nije spremljena.");
  }
}
