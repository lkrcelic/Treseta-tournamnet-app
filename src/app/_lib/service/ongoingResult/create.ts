import {ResultCreateRequest} from "@/app/_interfaces/result";
import {prisma} from "@/app/_lib/prisma";
import {transformResult} from "@/app/_lib/helpers/databaseHelpers";
import {InvalidResultError, normalizeResult} from "@/app/_lib/validation/validateResult";
import {assertCallStands, ongoingMatchState} from "./matchState";
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
        const [match] = await tx.$queryRaw<{score_threshold: number | null, ends_at: Date | null}[]>`
            SELECT score_threshold, ends_at FROM "OngoingMatch" WHERE id = ${result.match_id} FOR UPDATE`;
        if (!match) {
            throw new InvalidResultError("Ovaj meč je već završen.");
        }
        const before = await ongoingMatchState(tx, result.match_id, match.score_threshold);
        if (before.winner !== null) {
            throw new InvalidResultError("Meč je gotov – završi ga umjesto da dodaješ igru.");
        }
        const timing = admin ? "on_time" : handTiming({now: new Date(), endsAt: match.ends_at, tied: before.score1 === before.score2});
        if (timing === "too_late") {
            throw new InvalidResultError(TIME_UP);
        }

        const created = await tx.ongoingResult.create({data: transformResult(result), select: {result_id: true}});
        await tx.ongoingMatch.update({
            where: {id: result.match_id},
            data: {
                player_pair1_score: {increment: result.team1_game_points},
                player_pair2_score: {increment: result.team2_game_points},
            },
        });
        const after = await ongoingMatchState(tx, result.match_id, match.score_threshold);
        assertCallStands(after);
        // a raised target gives the match five more minutes
        await syncDeadline(tx, result.match_id, after, match.score_threshold);
        return {resultId: created.result_id, closeNow: closesAfterHand(timing, after.score1 === after.score2)};
    });

    // the extra hand after the time: the match ends with it (the next match or the table's result follows, as after
    // Završi meč)
    if (closeNow) await closeByTime(result.match_id);
    return resultId;
}
