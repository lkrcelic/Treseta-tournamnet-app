import {ResultCreateRequest} from "@/app/_interfaces/result";
import {handError} from "@/app/_lib/game/scoring";

export class InvalidResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResultError";
  }
}

// Checks a hand sent by the client, so a buggy or tampered client can't store points that break the rules:
// a normal hand adds up to 11, a custom one stays within its limit, and only a custom hand has "s ovim dosta".
// (Whether the calling team reached the target is checked against the match's hands when it is saved.)
export function normalizeResult(result: ResultCreateRequest): ResultCreateRequest {
  const custom = result.custom ?? false;
  const error = handError(result.team1_game_points, result.team2_game_points, custom);
  if (error) {
    throw new InvalidResultError(error);
  }
  if (result.dosta_side && !custom) {
    throw new InvalidResultError("„S ovim dosta” upisuje se ručnim unosom.");
  }
  return {...result, custom};
}
