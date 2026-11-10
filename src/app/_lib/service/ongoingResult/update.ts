import {ResultCreateRequest} from "@/app/_interfaces/result";
import {assertZvanja, InvalidResultError, normalizeResult, sentZvanja} from "@/app/_lib/validation/validateResult";
import {HandZvanja, handTotals, NO_HAND_ZVANJA} from "@/app/_lib/game/scoring";
import {prisma} from "@/app/_lib/prisma";
import {assertCallStands, ongoingMatchState} from "./matchState";
import {syncDeadline} from "@/app/_lib/service/match/timeLimit";

type UpdateOngoingResultType = {
    result_id: number,
    resultData: ResultCreateRequest,
    // checks the hand (an admin's hand is checked before it gets here)
    normalize?: (r: ResultCreateRequest) => ResultCreateRequest,
}

// Replaces a hand (with its "s ovim dosta" call, or none) and moves the match score by the difference of the hand's
// totals, all in one transaction. The match is taken from the stored hand, never from the request body. A request
// without zvanja (a phone from before them) keeps the hand's own, unless it makes the hand custom, which has none.
export async function updateOngoingResult({result_id, resultData, normalize = normalizeResult}: UpdateOngoingResultType): Promise<void> {
    const result = normalize(resultData);

    await prisma.$transaction(async (tx) => {
        // Lock the hand so two edits of it at the same time can't both apply their difference to the match score
        const [existingResult] = await tx.$queryRaw<(HandZvanja & {match_id: number, team1_game_points: number, team2_game_points: number, declarations: boolean | null})[]>`
            SELECT o.match_id, o.team1_game_points, o.team2_game_points,
                   o.team1_zvanja3, o.team1_zvanja4, o.team2_zvanja3, o.team2_zvanja4, r.declarations
            FROM "OngoingResult" o
            JOIN "OngoingMatch" om ON om.id = o.match_id
            LEFT JOIN "Round" r ON r.id = om.round_id
            WHERE o.result_id = ${result_id} FOR UPDATE OF o`;
        if (!existingResult) {
            throw new InvalidResultError("Igra ne postoji.");
        }
        const custom = result.custom ?? false;
        const stored: HandZvanja = {
            team1_zvanja3: existingResult.team1_zvanja3,
            team1_zvanja4: existingResult.team1_zvanja4,
            team2_zvanja3: existingResult.team2_zvanja3,
            team2_zvanja4: existingResult.team2_zvanja4,
        };
        const zvanja = sentZvanja(result) ?? (custom ? NO_HAND_ZVANJA : stored);
        assertZvanja(zvanja, {custom, declarations: existingResult.declarations ?? true});

        await tx.ongoingResult.update({
            where: {result_id: result_id},
            data: {
                team1_game_points: result.team1_game_points,
                team2_game_points: result.team2_game_points,
                ...zvanja,
                custom,
                dosta_side: result.dosta_side ?? null,
            },
        });

        const [old1, old2] = handTotals({...existingResult, ...stored});
        const [new1, new2] = handTotals({team1_game_points: result.team1_game_points, team2_game_points: result.team2_game_points, ...zvanja});
        const match = await tx.ongoingMatch.update({
            where: {id: existingResult.match_id},
            data: {
                player_pair1_score: {increment: new1 - old1},
                player_pair2_score: {increment: new2 - old2},
            },
            select: {score_threshold: true},
        });
        const state = await ongoingMatchState(tx, existingResult.match_id, match.score_threshold);
        assertCallStands(state);
        // the target may have risen or fallen with the correction, and the deadline with it
        await syncDeadline(tx, existingResult.match_id, state, match.score_threshold);
    });
}
