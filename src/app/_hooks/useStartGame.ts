"use client";

import {createOngoingMatchAPI} from "@/app/_fetchers/ongoingMatch/create";
import {getOpenRoundByPlayerIdAPI, OpenScope} from "@/app/_fetchers/round/getOpenByPlayerId";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useState} from "react";

// "Započni igru": opens the running match of the player's open round, or starts it (after the lineup, for a round
// whose players aren't confirmed yet). replace: the game takes the current page's place (a shared link to the
// player's own table goes straight into the game, and Back doesn't come back to it). scope: a league's table or a
// tournament's (Početna's tabs), any by default.
export default function useStartGame({replace = false, scope = "any"}: {replace?: boolean; scope?: OpenScope} = {}) {
  const router = useTransitionRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const {roundId, ongoingMatchId, hasLineup} = await getOpenRoundByPlayerIdAPI(scope);
      // the round's first match: confirm who plays before the scoreboard (the lineup screen starts the match)
      if (ongoingMatchId == null && !hasLineup) {
        if (replace) router.replace(`/round/lineup/${roundId}`);
        else router.push(`/round/lineup/${roundId}`);
        return;
      }
      const id = ongoingMatchId ?? (await createOngoingMatchAPI({round_id: roundId, score_threshold: MATCH_THRESHOLD})).id;
      const target = `/ongoing-match/${id}`;
      // already there (the desktop menu opened from the scoreboard): nothing will take over, so stop the spinner
      if (window.location.pathname === target) {
        setStarting(false);
        return;
      }
      if (replace) router.replace(target);
      else router.push(target, "morph");
      // stays "starting" until the next page takes over
    } catch (e) {
      setError(e instanceof Error ? e.message : "Igru nije moguće pokrenuti.");
      setStarting(false);
    }
  }, [router, starting, replace, scope]);

  return {start, starting, error, clearError: () => setError(null)};
}
