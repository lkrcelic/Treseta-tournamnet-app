import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {TeamPlayerAddValidation} from "@/app/_interfaces/team";
import {addPlayerToTeam} from "@/app/_lib/service/team/addPlayer";

// Add a teammate (admin). Adding someone who is already in the team is a no-op.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const {player_id} = TeamPlayerAddValidation.parse(await request.json());
    const created = await addPlayerToTeam(Number(params.id), player_id);
    return NextResponse.json(created, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to add the teammate.");
  }
}
