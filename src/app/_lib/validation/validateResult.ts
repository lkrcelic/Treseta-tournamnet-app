import {ResultCreateRequest} from "@/app/_interfaces/result";
import {handError} from "@/app/_lib/game/scoring";

export class InvalidResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResultError";
  }
}

// Checks a hand sent by the client, so a buggy or tampered client can't store points that break the rules:
// a normal hand adds up to 11, a custom one stays within its limit.
export function normalizeResult(result: ResultCreateRequest): ResultCreateRequest {
  const custom = result.custom ?? false;
  const error = handError(result.team1_game_points, result.team2_game_points, custom);
  if (error) {
    throw new InvalidResultError(error);
  }
  return {...result, custom};
}
