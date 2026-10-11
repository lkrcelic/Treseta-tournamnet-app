import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {deleteLeagueRound, listLeagueRounds} from "@/app/_lib/service/admin/tables";

type Params = {params: {leagueId: string}};

// The league's rounds per night with their state (Manage League · Rounds)
export async function GET(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await listLeagueRounds(Number(params.leagueId)), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to load the rounds.");
  }
}

const RoundKeyValidation = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  round_number: z.coerce.number().int().positive(),
});

// Deletes a round of a night: ?date=YYYY-MM-DD&round_number=N
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const {date, round_number} = RoundKeyValidation.parse({date: sp.get("date"), round_number: sp.get("round_number")});
    const tables = await deleteLeagueRound(Number(params.leagueId), new Date(date), round_number);
    return NextResponse.json({tables}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to delete the round.");
  }
}
