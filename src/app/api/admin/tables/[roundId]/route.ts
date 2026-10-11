import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {getTablePad} from "@/app/_lib/service/admin/hands";
import {editTablePair, removeTable} from "@/app/_lib/service/admin/tables";

type Params = {params: {roundId: string}};

// A table with every match and hand, for the admin scorepad
export async function GET(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await getTablePad(Number(params.roundId)), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to load the table.");
  }
}

const PairValidation = z.object({team1_id: z.number().int(), team2_id: z.number().int()});

// Seats two teams at the table (a team from another table of the round swaps places)
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const {team1_id, team2_id} = PairValidation.parse(await request.json());
    const changed = await editTablePair(Number(params.roundId), team1_id, team2_id);
    return NextResponse.json({changed}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to change the pair.");
  }
}

// Removes the table and what was played at it
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    await removeTable(Number(params.roundId));
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to remove the table.");
  }
}
