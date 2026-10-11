import {NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";

// Turns errors thrown by validation into a 400 with a readable message; anything else is logged and becomes a 500.
export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json({error: error.issues}, {status: STATUS.BadRequest});
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({error: error.message}, {status: STATUS.NotFound});
  }
  if (error instanceof InvalidResultError) {
    return NextResponse.json({error: error.message}, {status: STATUS.BadRequest});
  }
  console.error(error);
  return NextResponse.json({error: fallbackMessage}, {status: STATUS.ServerError});
}
