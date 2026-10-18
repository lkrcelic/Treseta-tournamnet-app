import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {listAdminPlayers} from "@/app/_lib/service/players/admin";
import {STATUS} from "@/app/_lib/statusCodes";

export const dynamic = "force-dynamic";

// The Igrači directory and the "Dodaj igrača" options (admin): every player but the deleted ones, with their
// username, teams and whether the account is active (AdminPlayerRow)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listAdminPlayers(auth.user), {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Igrači se nisu učitali."}, {status: STATUS.ServerError});
  }
}
