import {BelaResultCreateRequest} from "@/app/_interfaces/belaResult";

const BELA_SUM = 162;
const COMPLETE_VICTORY = 252;

const ann_map = {"TWENTY": 20, "FIFTY": 50, "ONE_HUNDRED": 100, "ONE_HUNDRED_FIFTY": 150, "TWO_HUNDRED": 200};

export function belaResultIsValid(belaResult: BelaResultCreateRequest): boolean {
    // TODO: Implement validation of pass/fall -> need information on exact player pairs from MATCH
    if (belaResult.complete_victory) {
        if (belaResult.player_pair1_game_points === belaResult.player_pair2_game_points) {
            return false;
        }
        if ((belaResult.player_pair1_game_points !== COMPLETE_VICTORY) &&
            (belaResult.player_pair2_game_points !== COMPLETE_VICTORY)) {
            return false;
        }
    } else {
        if ((belaResult.player_pair1_game_points + belaResult.player_pair2_game_points) !== BELA_SUM) {
            return false;
        }
        if (belaResult.player_pair1_total_points === belaResult.player_pair2_total_points) {
            return false;
        }
    }
    if (belaResult.announcements?.length) {
        const announcement_sum = belaResult.announcements.reduce((sum, a) => sum + ann_map[a.announcement_type], 0);
        if (announcement_sum != (belaResult.player_pair1_announcement_points + belaResult.player_pair2_announcement_points)) {
            return false;
        }
    }

    return true;
}