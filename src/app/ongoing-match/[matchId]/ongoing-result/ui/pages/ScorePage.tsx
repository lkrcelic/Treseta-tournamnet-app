"use client";

import {HandsChangedError} from "@/app/_fetchers/ongoingResult/create";
import {getOngoingMatchAPI} from "@/app/_fetchers/ongoingMatch/getOne";
import {handError, handTotals, zvanjaError} from "@/app/_lib/game/scoring";
import useResultStore from "@/app/_store/game/resultStore";
import useRoundStore from "@/app/_store/RoundStore";
import {color, font, shadow} from "@/app/_styles/tokens";
import {ActionPair, buttonBase, ConfirmSheet, ErrorNote, PrimaryButton} from "@/app/_ui/sp";
import {discardHand, handsAtOpen, MATCH_CLOSED_TEXT, saveHand, saveRefusal, takeEntryOrigin} from "@/app/ongoing-match/ui/handFlow";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {navigateWithTransition, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useState} from "react";

export type ActionProps = {
  actionType: "CREATE" | "UPDATE";
};

export const SAME_HAND_TITLE = "Je li ovo nova igra?";

// The hand's points for the selected team; the other team gets the rest of 11. "Custom" types each team on its own
// (and drops the zvanja: a custom hand's typed points are its total). A table "na prolaz" has Kaput on that key
// instead: 11 : 0 to the selected team, a normal hand with its zvanja.
export default function ScorePage({actionType}: ActionProps) {
  const router = useTransitionRouter();
  const params = useParams<{matchId: string; resultId?: string}>();
  const result = useResultStore((s) => s.resultData);
  const {setGamePoints, resetScore, toggleCustom, setKaput} = useResultStore.getState();
  const sides = useMatchSides();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the match was closed before the hand was saved (saveRefusal): the player is told, and Na meč drops the hand and
  // leads to the board (`fromSheet`: the refusal came from the same-hand question's sheet)
  const [closed, setClosed] = useState<{fromSheet: boolean} | null>(null);
  // a hand was saved from another phone at the table while this one was entering its own: ask before saving
  const [sameHand, setSameHand] = useState<string | null>(null);

  const declarations = useRoundStore((s) => s.roundData?.declarations) ?? true;
  const naProlaz = useRoundStore((s) => s.roundData?.match_end) === "NA_PROLAZ";
  const invalid =
    handError(result.team1_game_points, result.team2_game_points, result.custom) !== null ||
    zvanjaError(result.zvanja.team1, result.zvanja.team2, {custom: result.custom, declarations}) !== null;
  const scoreboard = `/ongoing-match/${params.matchId}`;
  const base = `/ongoing-match/${params.matchId}/ongoing-result/${actionType === "CREATE" ? "new" : params.resultId}`;

  // The entry is one history entry ahead of the scoreboard, so the scoreboard is reached by going back; `fromSheet`:
  // the question's sheet has an entry of its own (overlayHistory), so the scoreboard is no longer exactly one back and
  // is opened by address.
  const toBoard = (fromSheet = false) => {
    const back = takeEntryOrigin(Number(params.matchId));
    if (back && !fromSheet) navigateWithTransition(() => window.history.go(-1), "back");
    else router.replace(scoreboard, "back");
  };

  // What the other phone entered, in this phone's left/right order, so the player recognises the hand
  const otherPhoneText = async (fallback: string) => {
    const at = handsAtOpen();
    if (at == null) return fallback;
    try {
      const match = await getOngoingMatchAPI(Number(params.matchId));
      const added = (match.results ?? []).slice(at);
      const last = added[added.length - 1];
      if (!last) return fallback;
      const [total1, total2] = handTotals({
        team1_game_points: last.team1_game_points ?? 0,
        team2_game_points: last.team2_game_points ?? 0,
        team1_zvanja3: last.team1_zvanja3 ?? 0,
        team1_zvanja4: last.team1_zvanja4 ?? 0,
        team2_zvanja3: last.team2_zvanja3 ?? 0,
        team2_zvanja4: last.team2_zvanja4 ?? 0,
      });
      const [left, right] = sides.left === 1 ? [total1, total2] : [total2, total1];
      const hand = `igra ${at + added.length} (${left} : ${right})`;
      return added.length === 1
        ? `S drugog mobitela je upisana ${hand}. Ako je to ova ista igra, odustani.`
        : `S drugog mobitela su upisane nove igre, zadnja je ${hand}. Ako je ona ova ista, odustani.`;
    } catch {
      return fallback;
    }
  };

  const save = async (force = false) => {
    if (saving || invalid) return;
    const fromSheet = sameHand != null;
    setSaving(true);
    setError(null);
    try {
      await saveHand(Number(params.matchId), actionType === "UPDATE" ? params.resultId : null, {force});
      toBoard(fromSheet);
    } catch (e) {
      if (e instanceof HandsChangedError) {
        setSameHand(await otherPhoneText(e.message));
        setSaving(false);
        return;
      }
      const refusal = await saveRefusal(Number(params.matchId), e);
      if (refusal.closed) {
        setSameHand(null);
        setClosed({fromSheet});
      } else setError(refusal.message);
      setSaving(false);
    }
  };

  // Odustani (and closing the sheet): the hand was already entered from the other phone, so this copy is dropped
  const dropSameHand = () => {
    setSameHand(null);
    discardHand();
    toBoard(true);
  };

  const back = () => {
    // a normal hand goes back to its zvanja, keeping the points typed (a custom hand and a table "bez zvanja" have none)
    if (declarations && !result.custom) {
      router.replace(`${base}/zvanja`, "back");
      return;
    }
    discardHand();
    // the entry is opened from the scoreboard, so going back keeps the history tidy
    if (takeEntryOrigin(Number(params.matchId))) router.back();
    else router.replace(scoreboard, "back");
  };

  const key = {
    ...buttonBase,
    height: 66,
    borderRadius: "16px",
    background: color.white,
    color: color.ink,
    fontFamily: font.display,
    fontSize: 30,
    fontWeight: 700,
    boxShadow: shadow.card,
    transition: "transform 100ms ease, opacity 200ms ease, background 200ms ease, color 200ms ease",
    "&:active:not(:disabled)": {transform: "scale(.95)", background: color.lineFill},
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
          {naProlaz ? (
            <Box
              component="button"
              type="button"
              onClick={setKaput}
              aria-label="Kaput: 11 : 0"
              sx={{...key, background: color.cream, color: color.navy, fontFamily: font.body, fontSize: 17, boxShadow: "none", "&:active:not(:disabled)": {transform: "scale(.95)"}}}
            >
              Kaput
            </Box>
          ) : (
            <Box
              component="button"
              type="button"
              onClick={toggleCustom}
              aria-pressed={result.custom}
              sx={{
                ...key,
                background: result.custom ? color.navy : color.cream,
                color: result.custom ? color.white : color.navy,
                fontFamily: font.body,
                fontSize: 17,
                boxShadow: "none",
                "&:active:not(:disabled)": {transform: "scale(.95)"},
              }}
            >
              Ručno
            </Box>
          )}
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
          {result.custom ? "Ručni unos: bodovi svake ekipe upisuju se posebno" : ""}
        </Box>
      </Box>
      {closed && <ErrorNote sx={{mb: "10px"}}>{MATCH_CLOSED_TEXT}</ErrorNote>}
      {error && <ErrorNote sx={{mb: "10px"}}>{error}</ErrorNote>}
      {closed ? (
        <PrimaryButton
          onClick={() => {
            discardHand();
            toBoard(closed.fromSheet);
          }}
        >
          Na meč
        </PrimaryButton>
      ) : (
        <ActionPair onBack={back} nextLabel="Spremi" onNext={() => save()} nextDisabled={invalid} nextLoading={saving} />
      )}
      <ConfirmSheet
        open={sameHand != null}
        onClose={dropSameHand}
        onConfirm={() => save(true)}
        title={SAME_HAND_TITLE}
        text={sameHand ?? ""}
        action="Upiši i ovu"
        icon={<HelpRoundedIcon />}
        danger={false}
        busy={saving}
      />
    </>
  );
}
