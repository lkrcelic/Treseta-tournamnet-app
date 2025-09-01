import {NextRequest, NextResponse} from "next/server";
import {PlayerCreateValidation, PlayerResponse} from "@/app/_interfaces/player";
import {prisma} from "@/app/_lib/prisma";
import {z} from "zod";
import argon2 from "argon2";
import {STATUS} from "@/app/_lib/statusCodes";
import {validateUniqueConstraintsPlayer, ValidationError} from "@/app/_lib/validation/playerUniqueConstraints";

export async function POST(request: NextRequest) {
  try {
    const req_data = await request.json();

    /* TODO: check if - data is valid
                          - username/email already in db
                          - generate salt, hash ptPassword and store in db
        */

    // TODO: make username case insensitive?
    const playerVal = PlayerCreateValidation.parse(req_data);
    await validateUniqueConstraintsPlayer(playerVal);

    playerVal.password_hash = await argon2.hash(playerVal.password_hash);

    const createdPlayer = await prisma.player.create({data: playerVal});
    const player = createdPlayer as PlayerResponse;

    return NextResponse.json(player, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: error.issues}, {status: STATUS.BadRequest});
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(error.errors, {status: STATUS.BadRequest});
    }
    return NextResponse.json({error: error}, {status: STATUS.ServerError});
  }
}
