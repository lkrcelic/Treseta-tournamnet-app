import {Player} from "@prisma/client";
import {NextRequest} from "next/server";
import {resolveSession} from "./session";

// The logged-in player (Google session first, then the password session), or null
export async function getAuthorizedUser(req: NextRequest): Promise<Player | null> {
  try {
    return (await resolveSession(req))?.user ?? null;
  } catch (error) {
    console.error("Error validating session:", error);
    return null;
  }
}
