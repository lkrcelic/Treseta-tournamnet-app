import "./memoryStorage";
import {TeamSide} from "@/app/_interfaces/side";
import {ResultCreateRequest} from "@/app/_interfaces/result";
import useResultStore from "@/app/_store/game/resultStore";

// Enters one hand through the store the way the scoreboard screens do, and returns the request saveHand would send:
//   normal: setActiveTeam + one keypad digit at a time; the other team gets the rest of 11
//   custom: the Custom key, then each team's points typed on their own
export type HandPlan =
  // the team whose points are typed, and what is typed ("10" types 1 then 0)
  | {typedFor: TeamSide; typed: string}
  // what is typed for team 1 and for team 2
  | {custom: [string, string]};

export function resetHand() {
  useResultStore.getState().resetResult();
}

const store = () => useResultStore.getState();

function type(digits: string) {
  for (const digit of digits) store().setGamePoints(Number(digit));
}

export function enterHand(matchId: number, plan: HandPlan): ResultCreateRequest {
  resetHand();
  store().setMatchId(matchId);

  if ("custom" in plan) {
    store().toggleCustom();
    store().setActiveTeam("team1");
    type(plan.custom[0]);
    store().setActiveTeam("team2");
    type(plan.custom[1]);
  } else {
    store().setActiveTeam(plan.typedFor === 1 ? "team1" : "team2");
    type(plan.typed);
  }

  // what saveHand sends
  const {team1_game_points, team2_game_points, custom} = store().resultData;
  return {match_id: matchId, team1_game_points, team2_game_points, custom};
}
