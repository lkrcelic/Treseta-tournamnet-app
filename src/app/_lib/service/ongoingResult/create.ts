import {ResultCreateRequest} from "@/app/_interfaces/result";
import {prisma} from "@/app/_lib/prisma";
import {transformResult} from "@/app/_lib/helpers/databaseHelpers";
import {InvalidResultError, normalizeResult} from "@/app/_lib/validation/validateResult";
import {MATCH_THRESHOLD, matchWinner} from "@/app/_lib/game/scoring";

// Saves a hand and adds it to the match score in one transaction, so the score can't drift from the hands.
// `normalize` checks the hand (an admin's hand is checked before it gets here). Returns the new hand's id.
export async function createResult(
    resultData: ResultCreateRequest,
    normalize: (r: ResultCreateRequest) => ResultCreateRequest = normalizeResult,
): Promise<number> {
    const result = normalize(resultData);

    return prisma.$transaction(async (tx) => {
        // Lock the match row so two phones saving at the same time are applied one after the other
        const [match] = await tx.$queryRaw<{player_pair1_score: number, player_pair2_score: number, score_threshold: number | null}[]>`
            SELECT player_pair1_score, player_pair2_score, score_threshold
            FROM "OngoingMatch" WHERE id = ${result.match_id} FOR UPDATE`;
        if (!match) {
            throw new InvalidResultError("Ovaj meč je već završen.");
        }
        if (matchWinner(match.player_pair1_score, match.player_pair2_score, match.score_threshold ?? MATCH_THRESHOLD) !== null) {
            throw new InvalidResultError("Meč je gotov – završi ga umjesto da dodaješ igru.");
        }

        const created = await tx.ongoingResult.create({data: transformResult(result), select: {result_id: true}});
        await tx.ongoingMatch.update({
            where: {id: result.match_id},
            data: {
                player_pair1_score: {increment: result.team1_game_points},
                player_pair2_score: {increment: result.team2_game_points},
            },
        });
        return created.result_id;
    });
}
