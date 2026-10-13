import {NextRequest, NextResponse} from "next/server";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAllMatchesByRoundId} from "@/app/_lib/service/match/getAllByRoundId";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {prisma} from "@/app/_lib/prisma";
import {visibleRounds} from "@/app/_lib/roundStatus";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const roundId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either; NaN would reach Prisma as null and
  // list the matches without a round
  if (!isDbId(roundId)) return NextResponse.json({error: "Runda ne postoji."}, {status: STATUS.NotFound});

  try {
    // a round that isn't published yet is only for admins
    if (!(await prisma.round.count({where: {id: roundId, ...visibleRounds(isAdmin(auth.user))}}))) {
      return NextResponse.json({error: "Runda ne postoji."}, {status: STATUS.NotFound});
    }
    const round = await getAllMatchesByRoundId(roundId)

    return NextResponse.json(round, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Mečevi se nisu učitali."}, {status: STATUS.BadRequest});
  }
}
