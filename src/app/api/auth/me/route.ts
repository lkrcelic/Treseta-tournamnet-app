import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/app/_lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Return only minimal, safe fields
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (e) {
    console.error("/api/auth/me error", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
