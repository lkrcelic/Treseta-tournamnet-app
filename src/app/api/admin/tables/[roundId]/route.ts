import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {getTablePad} from "@/app/_lib/service/admin/hands";
import {editTablePair, refuseUnlessMyTable, removeTable} from "@/app/_lib/service/admin/tables";
import {ensureNextKoloDraft} from "@/app/_lib/service/tournament/kola";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

type Params = {params: {roundId: string}};

// an id the database can't hold (also a malformed one) doesn't exist either; a new response each time
const tableNotFound = () => NextResponse.json({error: "Stol ne postoji."}, {status: STATUS.NotFound});

// A table with every match and hand, for the admin scorepad: the admin on a league night, the organizer on a Kolo of
// their own tournament. The capability only gets as far as the lookup — refuseUnlessMyTable says whose table this is
// (DECISIONS #86).
export async function GET(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const roundId = Number(params.roundId);
  if (!isDbId(roundId)) return tableNotFound();
  try {
    await refuseUnlessMyTable(roundId, auth.user);
    return NextResponse.json(await getTablePad(roundId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Stol se nije učitao.");
  }
}

const PairValidation = z.object({team1_id: z.number().int(), team2_id: z.number().int()});

// Seats two teams at the table (a team from another table of the round swaps places)
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const roundId = Number(params.roundId);
  if (!isDbId(roundId)) return tableNotFound();
  try {
    await refuseUnlessMyTable(roundId, auth.user);
    const {team1_id, team2_id} = PairValidation.parse(await request.json());
    const changed = await editTablePair(roundId, team1_id, team2_id);
    return NextResponse.json({changed}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Par nije spremljen.");
  }
}

// Removes the table and what was played at it
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const roundId = Number(params.roundId);
  if (!isDbId(roundId)) return tableNotFound();
  try {
    await refuseUnlessMyTable(roundId, auth.user);
    const competition = await removeTable(roundId);
    // the last open table of a tournament's Kolo gone: the next Kolo's draft
    if (competition.kind === "tournament") await ensureNextKoloDraft(competition.id);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Stol nije uklonjen.");
  }
}
