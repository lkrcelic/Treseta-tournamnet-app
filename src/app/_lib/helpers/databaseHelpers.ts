import {BelaAnnouncementEnum, TrumpCallerPositionEnum} from "@prisma/client"
import {BelaResultCreateRequest} from "@/app/_interfaces/belaResult"

// BELA RESULT
interface BelaResultTransformed {
  match_id: number,
  player_pair1_game_points: number,
  player_pair2_game_points: number,
  player_pair1_announcement_points: number,
  player_pair2_announcement_points: number,
  player_pair1_total_points: number,
  player_pair2_total_points: number,
  card_shuffler_id: number | undefined,
  trump_caller_id: number | undefined,
  trump_caller_position: TrumpCallerPositionEnum,
  pass: boolean,
  complete_victory: boolean,
  belaPlayerAnnouncements: object
}

export function transformBelaResult(belaResult: BelaResultCreateRequest): BelaResultTransformed {
  return {
    match_id: belaResult.match_id,
    player_pair1_game_points: belaResult.player_pair1_game_points,
    player_pair2_game_points: belaResult.player_pair2_game_points,
    player_pair1_announcement_points: belaResult.player_pair1_announcement_points,
    player_pair2_announcement_points: belaResult.player_pair2_announcement_points,
    player_pair1_total_points: belaResult.player_pair1_total_points,
    player_pair2_total_points: belaResult.player_pair2_total_points,
    card_shuffler_id: belaResult.card_shuffler_id,
    trump_caller_id: belaResult.trump_caller_id,
    trump_caller_position: belaResult.trump_caller_position,
    pass: belaResult.pass,
    complete_victory: belaResult.complete_victory,
    belaPlayerAnnouncements: {create: belaResult.announcements ?? []}
  }
}


// BELA MATCH
export interface BelaMatchAllIncluded {
  id: number,
  round_id: number | null,
  player_pair_id1: number | null,
  player_pair_id2: number | null,
  player_pair1_score: number,
  player_pair2_score: number,
  score_threshold: number | null,
  start_time: Date | null,
  end_time: Date | null,
  match_date: Date | null,
  belaResults: {
    result_id: number,
    match_id: number,
    player_pair1_game_points: number,
    player_pair2_game_points: number,
    player_pair1_announcement_points: number,
    player_pair2_announcement_points: number,
    player_pair1_total_points: number,
    player_pair2_total_points: number,
    card_shuffler_id: number | null,
    trump_caller_id: number | null,
    trump_caller_position: TrumpCallerPositionEnum,
    pass: boolean,
    complete_victory: boolean,
    belaPlayerAnnouncements: {
      announcement_id: number,
      result_id: number,
      player_id: number,
      announcement_type: BelaAnnouncementEnum
    }[]
  }[]
}

interface BelaMatchTransformed {
  round_id: number | null,
  player_pair_id1: number | null,
  player_pair_id2: number | null,
  player_pair1_score: number,
  player_pair2_score: number,
  score_threshold: number | null,
  start_time: Date | null,
  end_time: Date | null,
  match_date: Date | null,
  belaResults: object
}

export function transformBelaMatch(match: BelaMatchAllIncluded): BelaMatchTransformed {
  return {
    round_id: match.round_id,
    player_pair_id1: match.player_pair_id1,
    player_pair_id2: match.player_pair_id2,
    player_pair1_score: match.player_pair1_score,
    player_pair2_score: match.player_pair2_score,
    score_threshold: match.score_threshold,
    start_time: match.start_time,
    end_time: match.end_time,
    match_date: match.match_date,
    belaResults: {
      create: match.belaResults.map(res => {
        return {
          player_pair1_game_points: res.player_pair1_game_points,
          player_pair2_game_points: res.player_pair2_game_points,
          player_pair1_announcement_points: res.player_pair1_announcement_points,
          player_pair2_announcement_points: res.player_pair2_announcement_points,
          player_pair1_total_points: res.player_pair1_total_points,
          player_pair2_total_points: res.player_pair2_total_points,
          card_shuffler_id: res.card_shuffler_id,
          trump_caller_id: res.trump_caller_id,
          trump_caller_position: res.trump_caller_position,
          pass: res.pass,
          complete_victory: res.complete_victory,
          belaPlayerAnnouncements: {
            create: res.belaPlayerAnnouncements.map(ann => {
              return {
                player_id: ann.player_id,
                announcement_type: ann.announcement_type
              };
            })
          }
        };
      })
    }
  }
}