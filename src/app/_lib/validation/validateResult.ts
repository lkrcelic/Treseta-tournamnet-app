import {ResultCreateRequest} from "@/app/_interfaces/result";
import {handError, HandZvanja, handZvanja, NO_HAND_ZVANJA, zvanjaError} from "@/app/_lib/game/scoring";

export class InvalidResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResultError";
  }
}

// The admin's change of a finished match would leave it without a winner: not an error, a warning the admin confirms
// (the scorepad sends the change again with allow_no_winner=1). The API answers it with 409 and code "no_winner".
export class NoWinnerWarning extends InvalidResultError {
  constructor(message: string) {
    super(message);
    this.name = "NoWinnerWarning";
  }
}

export const NO_WINNER_CODE = "no_winner";

// A hand's zvanja as the client sent them, or null when it sent none of the four (a phone from before zvanja): a new
// hand then has none, and a corrected one keeps its own. Any count left out of a hand that sends some is 0.
export function sentZvanja(result: ResultCreateRequest): HandZvanja | null {
  const {team1_zvanja3, team1_zvanja4, team2_zvanja3, team2_zvanja4} = result;
  if ([team1_zvanja3, team1_zvanja4, team2_zvanja3, team2_zvanja4].every((n) => n === undefined)) return null;
  return {
    team1_zvanja3: team1_zvanja3 ?? 0,
    team1_zvanja4: team1_zvanja4 ?? 0,
    team2_zvanja3: team2_zvanja3 ?? 0,
    team2_zvanja4: team2_zvanja4 ?? 0,
  };
}

// The zvanja a new hand is stored with
export const newHandZvanja = (result: ResultCreateRequest): HandZvanja => sentZvanja(result) ?? NO_HAND_ZVANJA;

// Refuses zvanja the cards can't make, zvanja on a custom hand, and any zvanje at a table "bez zvanja"
// (`declarations` false: Round.declarations of a tournament's Kolo)
export function assertZvanja(zvanja: HandZvanja, {custom, declarations = true}: {custom: boolean; declarations?: boolean}) {
  const [z1, z2] = handZvanja(zvanja);
  const error = zvanjaError(z1, z2, {custom, declarations});
  if (error) throw new InvalidResultError(error);
}

// Checks a hand sent by the client, so a buggy or tampered client can't store points that break the rules:
// a normal hand adds up to 11, a custom one stays within its limit, only a custom hand has "s ovim dosta", and the
// zvanja sent are ones the cards allow (none on a custom hand). Whether the calling team reached the target, and whether
// the table plays with zvanja, are checked against the match when the hand is saved.
export function normalizeResult(result: ResultCreateRequest): ResultCreateRequest {
  const custom = result.custom ?? false;
  const error = handError(result.team1_game_points, result.team2_game_points, custom);
  if (error) {
    throw new InvalidResultError(error);
  }
  if (result.dosta_side && !custom) {
    throw new InvalidResultError("„S ovim dosta” upisuje se ručnim unosom.");
  }
  const zvanja = sentZvanja(result);
  if (zvanja) assertZvanja(zvanja, {custom});
  return {...result, custom};
}
