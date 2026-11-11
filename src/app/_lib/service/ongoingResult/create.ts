import {ResultCreateRequest} from "@/app/_interfaces/result";
import {prisma} from "@/app/_lib/prisma";
import {transformResult} from "@/app/_lib/helpers/databaseHelpers";
import {assertZvanja, InvalidResultError, newHandZvanja, normalizeResult} from "@/app/_lib/validation/validateResult";
import {handTotals} from "@/app/_lib/game/scoring";
import {assertCallStands, assertPlayersHand, ongoingMatchState} from "./matchState";
import type {MatchEnd} from "@/app/_lib/game/scoring";
import {closesAfterHand, handTiming} from "@/app/_lib/gameTime";
import {closeByTime, syncDeadline} from "@/app/_lib/service/match/timeLimit";

// what a hand entered after the time is answered with (the match is closed with the score it had)
export const TIME_UP = "Vrijeme partije je isteklo. Partija se zatvara s upisanim rezultatom.";

// Saves a hand and adds it to the match score in one transaction, so the score can't drift from the hands.
// `normalize` checks the hand (an admin's hand is checked before it gets here). Returns the new hand's id.
//
// Vrijeme partije: a hand entered after the time is refused, unless the score is level — that one more hand is played,
// and the match ends with it (`admin`: an admin's correction is never refused for being late).
export async function createResult(
    resultData: ResultCreateRequest,
    normalize: (r: ResultCreateRequest) => ResultCreateRequest = normalizeResult,
    {admin = false}: {admin?: boolean} = {},
): Promise<number> {
    const result = normalize(resultData);

    const {resultId, closeNow} = await prisma.$transaction(async (tx) => {
        // Lock the match row so two phones saving at the same time are applied one after the other
        // (and read whether its table plays with zvanja: a tournament's table "bez zvanja" takes none)
        const [match] = await tx.$queryRaw<{score_threshold: number | null, ends_at: Date | null, declarations: boolean | null, match_end: MatchEnd | null}[]>`
            SELECT om.score_threshold, om.ends_at, r.declarations, r.match_end
            FROM "OngoingMatch" om LEFT JOIN "Round" r ON r.id = om.round_id
            WHERE om.id = ${result.match_id} FOR UPDATE OF om`;
        if (!match) {
            throw new InvalidResultError("Ovaj meč je već završen.");
        }
        const zvanja = newHandZvanja(result);
        assertZvanja(zvanja, {custom: result.custom ?? false, declarations: match.declarations ?? true});
        assertPlayersHand(result.custom ?? false, match.match_end, admin);
        const before = await ongoingMatchState(tx, result.match_id, match.score_threshold);
        if (before.winner !== null) {
            throw new InvalidResultError("Meč je gotov – završi ga umjesto da dodaješ igru.");
        }
        const timing = admin ? "on_time" : handTiming({now: new Date(), endsAt: match.ends_at, tied: before.score1 === before.score2});
        if (timing === "too_late") {
            throw new InvalidResultError(TIME_UP);
        }

        const created = await tx.ongoingResult.create({data: transformResult(result), select: {result_id: true}});
        // the hand's total: its points and its zvanja
        const [total1, total2] = handTotals({team1_game_points: result.team1_game_points, team2_game_points: result.team2_game_points, ...zvanja});
        await tx.ongoingMatch.update({
            where: {id: result.match_id},
            data: {
                player_pair1_score: {increment: total1},
                player_pair2_score: {increment: total2},
            },
        });
        const after = await ongoingMatchState(tx, result.match_id, match.score_threshold);
        assertCallStands(after);
        // a raised target ("na prolaz": a level score at or above it) gives the match five more minutes
        await syncDeadline(tx, result.match_id, after);
        return {resultId: created.result_id, closeNow: closesAfterHand(timing, after.score1 === after.score2)};
    });

    // the extra hand after the time: the match ends with it (the next match or the table's result follows, as after
    // Završi meč)
    if (closeNow) await closeByTime(result.match_id);
    return resultId;
}
