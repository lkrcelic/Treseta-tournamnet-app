"use client";

import useResultStore from "@/app/_store/game/resultStore";
import {color, font, teamColor} from "@/app/_styles/tokens";
import {buttonBase, Eyebrow, tabular} from "@/app/_ui/sp";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import {Box} from "@mui/material";
import {useEffect} from "react";

// The two team boxes pick which team the points are typed for
export default function WizardHeader() {
  const sides = useMatchSides();
  const result = useResultStore((s) => s.resultData);
  const setActiveTeam = useResultStore((s) => s.setActiveTeam);

  // the entry starts with the viewer's team selected
  useEffect(() => {
    setActiveTeam(sides.key(sides.left));
  }, [sides.left]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = result.activeTeam === "team2" ? 2 : 1;
  const points = (side: 1 | 2) => (side === 1 ? result.team1_game_points : result.team2_game_points) ?? 0;

  return (
    <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none", viewTransitionName: "team-header"}}>
      <Eyebrow sx={{px: "4px"}}>{result.result_id ? "Uredi igru" : "Nova igra"}</Eyebrow>
      <Box role="radiogroup" aria-label="Igra: upis za ekipu" sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
        {sides.sides.map((side, i) => {
          const on = active === side;
          const value = points(side);
          return (
            <Box
              key={side}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${sides.names[i]}: igra ${value}`}
              onClick={() => setActiveTeam(sides.key(side))}
              sx={{
                ...buttonBase,
                height: 92,
                borderRadius: "20px",
                border: `2.5px solid ${teamColor[i]}`,
                background: on ? teamColor[i] : color.card,
                color: on ? "#FFFFFF" : teamColor[i],
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: "2px",
                px: "16px",
                transition: "background 200ms ease, color 200ms ease",
                minWidth: 0,
              }}
            >
              <Box component="span" sx={{fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                Igra · {sides.names[i]}
              </Box>
              <Box component="span" sx={{fontFamily: font.display, fontSize: 38, fontWeight: 800, lineHeight: 1, ...tabular}}>
                {value}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
