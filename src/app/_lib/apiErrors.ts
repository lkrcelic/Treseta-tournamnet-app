import {NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {zodMessage} from "@/app/_lib/validation/zodMessage";

// Turns errors thrown by validation into a 400 with a readable message; anything else is logged and becomes a 500.
// The message is always a string in `error` (Croatian); a zod error also lists its issues.
export function errorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json({error: zodMessage(error, fallbackMessage), issues: error.issues}, {status: STATUS.BadRequest});
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

// For a GET of one row: a missing row (NotFoundError) is a 404 and isn't logged. Anything else is a server fault and
// a logged 500, including a ZodError, which here can only come from checking the response, not the request.
export function lookupErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({error: error.message}, {status: STATUS.NotFound});
  }
  console.error(error);
  return NextResponse.json({error: fallbackMessage}, {status: STATUS.ServerError});
}
