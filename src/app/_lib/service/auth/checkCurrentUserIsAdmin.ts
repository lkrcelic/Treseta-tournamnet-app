import { NextRequest } from "next/server";
import { getAuthorizedUser } from "./getAuthorizedUser";
import { RoleEnum } from "@prisma/client";

export async function checkCurrentUserIsAdmin(req: NextRequest): Promise<boolean> {
  const user = await getAuthorizedUser(req);
  return user?.player_role === RoleEnum.ADMIN;
}
