import {ResultCreateRequest} from "@/app/_interfaces/result";
import {HandZvanja} from "@/app/_lib/game/scoring";
import {newHandZvanja} from "@/app/_lib/validation/validateResult";

// HAND (a new one: zvanja it doesn't send are none)
interface ResultTransformed extends HandZvanja {
  match_id: number,
  team1_game_points: number,
  team2_game_points: number,
  custom: boolean,
  dosta_side: number | null,
}

export function transformResult(result: ResultCreateRequest): ResultTransformed {
  return {
    match_id: result.match_id,
    team1_game_points: result.team1_game_points,
    team2_game_points: result.team2_game_points,
    ...newHandZvanja(result),
    custom: result.custom ?? false,
    dosta_side: result.dosta_side ?? null,
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
  results: (HandZvanja & {
    result_id: number,
    match_id: number,
    team1_game_points: number,
    team2_game_points: number,
    custom: boolean,
    dosta_side: number | null,
  })[]
}

interface MatchTransformed {
  round_id: number | null,
  player_pair1_score: number,
  player_pair2_score: number,
  score_threshold: number | null,
  winner_side: number,
  start_time: Date | null,
  end_time: Date | null,
  match_date: Date | null,
  results: object
}

export function transformMatch(match: MatchAllIncluded, winnerSide: number): MatchTransformed {
  return {
    round_id: match.round_id,
    player_pair1_score: match.player_pair1_score,
    player_pair2_score: match.player_pair2_score,
    score_threshold: match.score_threshold,
    winner_side: winnerSide,
    start_time: match.start_time,
    end_time: match.end_time,
    match_date: match.match_date,
    results: {
      create: match.results.map((res) => ({
        team1_game_points: res.team1_game_points,
        team2_game_points: res.team2_game_points,
        team1_zvanja3: res.team1_zvanja3,
        team1_zvanja4: res.team1_zvanja4,
        team2_zvanja3: res.team2_zvanja3,
        team2_zvanja4: res.team2_zvanja4,
        custom: res.custom,
        dosta_side: res.dosta_side,
      })),
    },
  };
}
