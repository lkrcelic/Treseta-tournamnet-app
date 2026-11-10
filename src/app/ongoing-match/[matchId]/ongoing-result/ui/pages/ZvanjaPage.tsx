"use client";

import {canAddZvanje, hasZvanja} from "@/app/_lib/game/scoring";
import useResultStore from "@/app/_store/game/resultStore";
import useRoundStore from "@/app/_store/RoundStore";
import {ActionPair} from "@/app/_ui/sp";
import {discardHand, takeEntryOrigin} from "@/app/ongoing-match/ui/handFlow";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import {ZvanjaButtons} from "@/app/ongoing-match/ui/WizardParts";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useParams} from "next/navigation";
import {useEffect} from "react";
import {ActionProps} from "./ScorePage";

// The first step of a hand: each team's zvanja (3 and 4, one click a zvanje) for the team picked in the header, then
// Dalje to the points. A table "bez zvanja" and a custom hand have no zvanja, so they go straight on to the points.
// Dalje replaces this step with the points (it doesn't push), so the scoreboard stays one history entry behind the
// entry and saving goes back to it as before.
export default function ZvanjaPage({actionType}: ActionProps) {
  const router = useTransitionRouter();
  const params = useParams<{matchId: string; resultId?: string}>();
  const sides = useMatchSides();
  const result = useResultStore((s) => s.resultData);
  const {addZvanje, clearZvanja} = useResultStore.getState();
  const declarations = useRoundStore((s) => s.roundData?.declarations) ?? true;

  const base = `/ongoing-match/${params.matchId}/ongoing-result/${actionType === "CREATE" ? "new" : params.resultId}`;
  const scoreboard = `/ongoing-match/${params.matchId}`;
  const skip = !declarations || result.custom;

  useEffect(() => {
    if (skip) router.replace(`${base}/score`);
  }, [skip, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const side = result.activeTeam === "team2" ? 2 : 1;
  const index = sides.sides.indexOf(side) === 1 ? 1 : 0;
  const {team1, team2} = result.zvanja;
  const none = !hasZvanja(team1) && !hasZvanja(team2);

  const back = () => {
    discardHand();
    if (takeEntryOrigin(Number(params.matchId))) router.back();
    else router.replace(scoreboard, "back");
  };

  return (
    <>
      <ZvanjaButtons
        label={`Zvanja: ${sides.names[index]}`}
        counts={result.zvanja[result.activeTeam]}
        team={index}
        onAdd={addZvanje}
        onClear={clearZvanja}
        canAdd={(v) => canAddZvanje(team1, team2, side, v)}
      />
      <ActionPair onBack={back} nextLabel={none ? "Nema zvanja" : "Dalje"} onNext={() => router.replace(`${base}/score`)} />
    </>
  );
}
