"use client";

import {handError} from "@/app/_lib/game/scoring";
import useResultStore from "@/app/_store/game/resultStore";
import {color, font} from "@/app/_styles/tokens";
import {ActionPair, buttonBase, ErrorNote} from "@/app/_ui/sp";
import {discardHand, saveHand, takeEntryOrigin} from "@/app/ongoing-match/ui/handFlow";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {navigateWithTransition, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useState} from "react";

export type ActionProps = {
  actionType: "CREATE" | "UPDATE";
};

// The hand's points for the selected team; the other team gets the rest of 11. "Custom" types each team on its own.
export default function ScorePage({actionType}: ActionProps) {
  const router = useTransitionRouter();
  const params = useParams<{matchId: string; resultId?: string}>();
  const result = useResultStore((s) => s.resultData);
  const {setGamePoints, resetScore, toggleCustom} = useResultStore.getState();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = handError(result.team1_game_points, result.team2_game_points, result.custom) !== null;
  const scoreboard = `/ongoing-match/${params.matchId}`;

  const save = async () => {
    if (saving || invalid) return;
    setSaving(true);
    setError(null);
    try {
      await saveHand(Number(params.matchId), actionType === "UPDATE" ? params.resultId : null);
      if (takeEntryOrigin(Number(params.matchId))) navigateWithTransition(() => window.history.go(-1), "back");
      else router.replace(scoreboard, "back");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
      setSaving(false);
    }
  };

  const back = () => {
    discardHand();
    // the entry is opened from the scoreboard, so going back keeps the history tidy
    if (takeEntryOrigin(Number(params.matchId))) router.back();
    else router.replace(scoreboard, "back");
  };

  const key = {
    ...buttonBase,
    height: 66,
    borderRadius: "16px",
    background: color.card,
    color: color.ink,
    fontFamily: font.display,
    fontSize: 30,
    fontWeight: 700,
    boxShadow: "0 1px 2px rgba(31,36,51,.06)",
    transition: "transform 100ms ease, opacity 200ms ease, background 200ms ease, color 200ms ease",
    "&:active:not(:disabled)": {transform: "scale(.95)", background: "#EFEAE0"},
    "&:disabled": {opacity: 0.35},
  } as const;

  return (
    <>
      <Box sx={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", pb: "16px"}}>
        <Box role="group" aria-label="Bodovi igre" sx={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px"}}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <Box key={d} component="button" type="button" onClick={() => setGamePoints(d)} sx={key}>
              {d}
            </Box>
          ))}
          <Box
            component="button"
            type="button"
            onClick={toggleCustom}
            aria-pressed={result.custom}
            sx={{
              ...key,
              background: result.custom ? color.navy : color.cream,
              color: result.custom ? "#FFFFFF" : color.navy,
              fontFamily: font.body,
              fontSize: 17,
              boxShadow: "none",
              "&:active:not(:disabled)": {transform: "scale(.95)"},
            }}
          >
            Custom
          </Box>
          <Box component="button" type="button" onClick={() => setGamePoints(0)} sx={key}>
            0
          </Box>
          <Box
            component="button"
            type="button"
            onClick={resetScore}
            aria-label="Obriši bodove"
            sx={{...key, background: "transparent", border: `2px solid ${color.borderStrong}`, color: color.navy, fontSize: 26, boxShadow: "none"}}
          >
            X
          </Box>
        </Box>
        <Box aria-live="polite" sx={{minHeight: 20, pt: "10px", textAlign: "center", fontSize: 14, fontWeight: 600, color: color.muted}}>
          {result.custom ? "Custom: bodovi svake ekipe upisuju se posebno" : ""}
        </Box>
      </Box>
      {error && <ErrorNote sx={{mb: "10px"}}>{error}</ErrorNote>}
      <ActionPair onBack={back} nextLabel="Spremi" onNext={save} nextDisabled={invalid} nextLoading={saving} />
    </>
  );
}
