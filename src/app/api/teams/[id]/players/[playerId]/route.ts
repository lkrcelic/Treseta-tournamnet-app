import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {removePlayerFromTeam} from "@/app/_lib/service/team/addPlayer";

// Remove a teammate (admin). The team keeps its results; the player just no longer plays for it.
export async function DELETE(request: NextRequest, {params}: {params: {id: string; playerId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const removed = await removePlayerFromTeam(Number(params.id), Number(params.playerId));
    if (!removed) {
      return NextResponse.json({error: "The player is not in this team."}, {status: STATUS.NotFound});
    }
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to remove the teammate.");
  }
}
