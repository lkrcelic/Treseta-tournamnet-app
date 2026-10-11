import {ResultCreateRequest} from "@/app/_interfaces/result";

// HAND
interface ResultTransformed {
  match_id: number,
  team1_game_points: number,
  team2_game_points: number,
  custom: boolean,
}

export function transformResult(result: ResultCreateRequest): ResultTransformed {
  return {
    match_id: result.match_id,
    team1_game_points: result.team1_game_points,
    team2_game_points: result.team2_game_points,
    custom: result.custom ?? false,
  };
}


// MATCH: a match being played with its hands, stored as a finished match
export interface MatchAllIncluded {
  id: number,
  round_id: number | null,
  player_pair1_score: number,
  player_pair2_score: number,
  score_threshold: number | null,
  start_time: Date | null,
  end_time: Date | null,
  match_date: Date | null,
  results: {
    result_id: number,
    match_id: number,
    team1_game_points: number,
    team2_game_points: number,
    custom: boolean,
  }[]
}

interface MatchTransformed {
  round_id: number | null,
  player_pair1_score: number,
  player_pair2_score: number,
  score_threshold: number | null,
  start_time: Date | null,
  end_time: Date | null,
  match_date: Date | null,
  results: object
}

export function transformMatch(match: MatchAllIncluded): MatchTransformed {
  return {
    round_id: match.round_id,
    player_pair1_score: match.player_pair1_score,
    player_pair2_score: match.player_pair2_score,
    score_threshold: match.score_threshold,
    start_time: match.start_time,
    end_time: match.end_time,
    match_date: match.match_date,
    results: {
      create: match.results.map((res) => ({
        team1_game_points: res.team1_game_points,
        team2_game_points: res.team2_game_points,
        custom: res.custom,
      })),
    },
  };
}
