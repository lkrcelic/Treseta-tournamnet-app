"use client";

import {TeamSide} from "@/app/_interfaces/side";
import {handError} from "@/app/_lib/game/scoring";
import useResultStore from "@/app/_store/game/resultStore";
import {color, font, teamColor, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, PrimaryButton, SHORT_WINDOW, tabular} from "@/app/_ui/sp";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import {Box} from "@mui/material";
import {useEffect, useState} from "react";
import {discardHand, saveHand} from "./handFlow";

// Desktop: the team boxes and the keypad in one panel next to the scoreboard
export default function HandEntryPanel({
  matchId,
  sides,
  names,
  handNumber,
  editingId,
  onSaved,
  onCancelEdit,
}: {
  matchId: number;
  sides: [TeamSide, TeamSide];
  names: [string, string];
  handNumber: number;
  editingId: number | null;
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  const result = useResultStore((s) => s.resultData);
  const {setActiveTeam, setGamePoints, resetScore, toggleCustom, setMatchId} = useResultStore.getState();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSide: TeamSide = result.activeTeam === "team2" ? 2 : 1;
  const points = (side: TeamSide) => (side === 1 ? result.team1_game_points : result.team2_game_points) ?? 0;
  const canSave = handError(result.team1_game_points, result.team2_game_points, result.custom) === null;

  // a fresh hand starts with the viewer's team active. Depends on the side itself, not the sides array (a new array
  // on every render): the board re-renders on each refresh, which must not move the keypad to the other team.
  const viewerSide = sides[0];
  useEffect(() => {
    if (editingId == null) {
      // a hand left over from another match is dropped, one from this match is kept (e.g. after a reload)
      const pending = useResultStore.getState().resultData.match_id;
      if (pending != null && pending !== matchId) discardHand();
      setMatchId(matchId);
      setActiveTeam(viewerSide === 1 ? "team1" : "team2");
    }
  }, [editingId, matchId, viewerSide, setMatchId, setActiveTeam]);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveHand(matchId, editingId);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
    }
    setSaving(false);
  };

  // number keys type points, Enter saves (when the focus is not in a text field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        setGamePoints(Number(e.key));
        e.preventDefault();
      } else if (e.key === "Enter" && t?.tagName !== "BUTTON") {
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reset = () => {
    discardHand();
    setError(null);
    setMatchId(matchId);
    setActiveTeam(sides[0] === 1 ? "team1" : "team2");
    if (editingId != null) onCancelEdit();
  };

  const key = {
    ...buttonBase,
    borderRadius: "14px",
    background: color.paper,
    color: color.ink,
    fontFamily: font.display,
    fontSize: 26,
    fontWeight: 700,
    minHeight: 40,
    "&:active:not(:disabled)": {transform: "scale(.96)", background: color.lineFill},
    "&:disabled": {opacity: 0.35},
  } as const;

  return (
    <Card
      component="section"
      aria-labelledby="entry-title"
      sx={{
        minHeight: 0,
        borderRadius: "24px",
        p: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        // a short window (1024×640): everything a little smaller, and if it still doesn't fit the panel scrolls (the keys
        // never squeeze into each other)
        overflowY: "auto",
        [SHORT_WINDOW]: {p: "16px", gap: "8px"},
      }}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Box component="h2" id="entry-title" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
          {editingId != null ? `Uredi igru ${handNumber}` : `Igra ${handNumber}`}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={reset}
          sx={{...buttonBase, height: 36, px: "12px", borderRadius: "10px", background: color.paper, color: color.navy, fontSize: 14, fontWeight: 600}}
        >
          {editingId != null ? "Odustani" : "Poništi"}
        </Box>
      </Box>

      <Box role="radiogroup" aria-label="Upis za ekipu" sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
        {sides.map((side, i) => {
          const on = activeSide === side;
          return (
            <Box
              key={side}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${names[i]}: igra ${points(side)}`}
              onClick={() => setActiveTeam(side === 1 ? "team1" : "team2")}
              sx={{
                ...buttonBase,
                height: 84,
                minWidth: 0,
                [SHORT_WINDOW]: {height: 68},
                borderRadius: "16px",
                border: `2px solid ${teamColor[i]}`,
                background: on ? teamColor[i] : color.white,
                color: on ? color.white : teamColor[i],
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: "2px",
                px: "14px",
                textAlign: "left",
                transition: "background 200ms ease, color 200ms ease",
              }}
            >
              <Box component="span" sx={{maxWidth: "100%", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                Igra · {names[i]}
              </Box>
              <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 1, ...tabular}}>
                {points(side)}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{minHeight: 18, fontSize: 13, fontWeight: 600, color: color.muted}}>
        {result.custom ? "Ručni unos: bodovi svake ekipe upisuju se posebno." : "Druga ekipa dobiva ostatak do 11."}
      </Box>

      <Box
        role="group"
        aria-label="Bodovi igre"
        sx={{flex: "1 0 auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gridAutoRows: "minmax(40px,1fr)", gap: "8px"}}
      >
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
          sx={{...key, background: result.custom ? color.navy : color.cream, color: result.custom ? color.white : color.navy, fontFamily: font.body, fontSize: 16}}
        >
          Ručno
        </Box>
        <Box component="button" type="button" onClick={() => setGamePoints(0)} sx={key}>
          0
        </Box>
        <Box
          component="button"
          type="button"
          onClick={resetScore}
          aria-label="Obriši bodove"
          sx={{...key, background: "transparent", border: `2px solid ${tint.navy[25]}`, color: color.navy, fontSize: 22}}
        >
          X
        </Box>
      </Box>

      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={save} disabled={!canSave} loading={saving}>
        {editingId != null ? "Spremi izmjene" : "Spremi igru"}
      </PrimaryButton>
    </Card>
  );
}
