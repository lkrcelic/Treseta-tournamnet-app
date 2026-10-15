import {ResultCreateRequest} from "@/app/_interfaces/result";
import {InvalidResultError, normalizeResult} from "@/app/_lib/validation/validateResult";
import {prisma} from "@/app/_lib/prisma";
import {assertCallStands, ongoingMatchState} from "./matchState";

type UpdateOngoingResultType = {
    result_id: number,
    resultData: ResultCreateRequest,
    // checks the hand (an admin's hand is checked before it gets here)
    normalize?: (r: ResultCreateRequest) => ResultCreateRequest,
}

// Replaces a hand (with its "s ovim dosta" call, or none) and moves the match score by the difference, all in one
// transaction. The match is taken from the stored hand, never from the request body.
export async function updateOngoingResult({result_id, resultData, normalize = normalizeResult}: UpdateOngoingResultType): Promise<void> {
    const result = normalize(resultData);

    await prisma.$transaction(async (tx) => {
        // Lock the hand so two edits of it at the same time can't both apply their difference to the match score
        const [existingResult] = await tx.$queryRaw<{match_id: number, team1_game_points: number, team2_game_points: number}[]>`
            SELECT match_id, team1_game_points, team2_game_points
            FROM "OngoingResult" WHERE result_id = ${result_id} FOR UPDATE`;
        if (!existingResult) {
            throw new InvalidResultError("Igra ne postoji.");
        }

        await tx.ongoingResult.update({
            where: {result_id: result_id},
            data: {
                team1_game_points: result.team1_game_points,
                team2_game_points: result.team2_game_points,
                custom: result.custom ?? false,
                dosta_side: result.dosta_side ?? null,
            },
        });

        const match = await tx.ongoingMatch.update({
            where: {id: existingResult.match_id},
            data: {
                player_pair1_score: {increment: result.team1_game_points - existingResult.team1_game_points},
                player_pair2_score: {increment: result.team2_game_points - existingResult.team2_game_points},
            },
            select: {score_threshold: true},
        });
        assertCallStands(await ongoingMatchState(tx, existingResult.match_id, match.score_threshold));
    });
}
