import {NextRequest, NextResponse} from "next/server";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {prisma} from "@/app/_lib/prisma";
import {visibleRounds} from "@/app/_lib/roundStatus";
import {getTablePad} from "@/app/_lib/service/admin/hands";
import {toTableOverview} from "@/app/_lib/tableOverview";

// a new response each time
const tableNotFound = () => NextResponse.json({error: "Stol ne postoji."}, {status: STATUS.NotFound});

// One table read-only (Pregled stola): its teams and every match with each hand's totals. A round that isn't
// published yet is only for admins (anyone else: 404, the same as a table that doesn't exist).
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const roundId = Number(params.id);
  if (!isDbId(roundId)) return tableNotFound();
  try {
    if (!(await prisma.round.count({where: {id: roundId, ...visibleRounds(isAdmin(auth.user))}}))) return tableNotFound();
    return NextResponse.json(toTableOverview(await getTablePad(roundId)), {status: STATUS.OK});
  } catch (error) {
    return lookupErrorResponse(error, "Stol se nije učitao.");
  }
}
