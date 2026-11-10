import "./memoryStorage";
import {TeamSide} from "@/app/_interfaces/side";
import {ResultCreateRequest} from "@/app/_interfaces/result";
import useResultStore from "@/app/_store/game/resultStore";
import {NO_HAND_ZVANJA, Zvanje, zvanjaColumns} from "@/app/_lib/game/scoring";

// Enters one hand through the store the way the scoreboard screens do, and returns the request saveHand would send:
//   normal: each team's zvanja clicked, then setActiveTeam + one keypad digit at a time; the other team gets the rest
//           of 11
//   custom: the Custom key, then each team's points typed on their own
export type HandPlan =
  // the team whose points are typed, what is typed ("10" types 1 then 0), and the zvanja clicked for each team
  | {typedFor: TeamSide; typed: string; zvanja?: [Zvanje[], Zvanje[]]}
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
    plan.zvanja?.forEach((clicks, i) => {
      store().setActiveTeam(i === 0 ? "team1" : "team2");
      clicks.forEach((v) => store().addZvanje(v));
    });
    store().setActiveTeam(plan.typedFor === 1 ? "team1" : "team2");
    type(plan.typed);
  }

  // what saveHand sends
  const {team1_game_points, team2_game_points, custom, zvanja} = store().resultData;
  const counts = custom ? NO_HAND_ZVANJA : zvanjaColumns(zvanja.team1, zvanja.team2);
  return {match_id: matchId, team1_game_points, team2_game_points, ...counts, custom};
}
