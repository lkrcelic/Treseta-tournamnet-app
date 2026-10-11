import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {addTable} from "@/app/_lib/service/admin/tables";

const NewTableValidation = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  round_number: z.number().int().positive(),
  team1_id: z.number().int(),
  team2_id: z.number().int(),
});

// Adds a table to a round of a night
export async function POST(request: NextRequest, {params}: {params: {leagueId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const t = NewTableValidation.parse(await request.json());
    const id = await addTable(Number(params.leagueId), new Date(t.date), t.round_number, t.team1_id, t.team2_id);
    return NextResponse.json({id}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Failed to add the table.");
  }
}
