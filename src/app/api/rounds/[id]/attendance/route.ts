import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {answerAttendance} from "@/app/_lib/service/tournament/attendance";

const AnswerValidation = z.object({answer: z.enum(["PRESENT", "NO_SHOW"])});

// The answer to "Jesu li … za stolom?" by a player of the table: PRESENT (Da, tu su) or NO_SHOW (Ne, nisu došli).
// The first answer counts for the table; answers with what the table is now (PRESENT, NO_SHOW, SKIPPED, STARTED).
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const {answer} = AnswerValidation.parse(await request.json());
    const outcome = await answerAttendance(Number(params.id), auth.user, answer);
    return NextResponse.json({outcome}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Odgovor nije spremljen.");
  }
}
