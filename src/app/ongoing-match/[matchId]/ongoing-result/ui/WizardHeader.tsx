"use client";

import useResultStore from "@/app/_store/game/resultStore";
import {color, font, teamColor} from "@/app/_styles/tokens";
import {buttonBase, Eyebrow, tabular} from "@/app/_ui/sp";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import {useEffect} from "react";
import {zvanjaPoints} from "@/app/_lib/game/scoring";

// The two team boxes pick which team the zvanja (the Zvanja step) or the points (Igra) are entered for. On Igra a
// team's box also says what its zvanja add.
export default function WizardHeader() {
  const sides = useMatchSides();
  const result = useResultStore((s) => s.resultData);
  const setActiveTeam = useResultStore((s) => s.setActiveTeam);
  const onZvanja = usePathname()?.endsWith("/zvanja") ?? false;
  const label = onZvanja ? "Zvanja" : "Igra";

  // each step starts with the viewer's team selected
  useEffect(() => {
    setActiveTeam(sides.key(sides.left));
  }, [onZvanja, sides.left]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = result.activeTeam === "team2" ? 2 : 1;
  const zvanja = (side: 1 | 2) => zvanjaPoints(result.zvanja?.[side === 1 ? "team1" : "team2"] ?? {3: 0, 4: 0});
  const points = (side: 1 | 2) => (onZvanja ? zvanja(side) : ((side === 1 ? result.team1_game_points : result.team2_game_points) ?? 0));

  return (
    <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none", viewTransitionName: "team-header"}}>
      <Eyebrow sx={{px: "4px"}}>
        {result.result_id ? "Uredi igru" : "Nova igra"} · {label}
      </Eyebrow>
      <Box role="radiogroup" aria-label={`${label}: upis za ekipu`} sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
        {sides.sides.map((side, i) => {
          const on = active === side;
          const value = points(side);
          // on Igra: what the team's zvanja add to its points
          const extra = onZvanja ? 0 : zvanja(side);
          return (
            <Box
              key={side}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${sides.names[i]}: ${label.toLowerCase()} ${value}${extra ? `, zvanja ${extra}` : ""}`}
              onClick={() => setActiveTeam(sides.key(side))}
              sx={{
                ...buttonBase,
                height: 92,
                borderRadius: "20px",
                border: `2.5px solid ${teamColor[i]}`,
                background: on ? teamColor[i] : color.white,
                color: on ? color.white : teamColor[i],
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
                {label} · {sides.names[i]}
              </Box>
              <Box component="span" sx={{display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0}}>
                <Box component="span" sx={{fontFamily: font.display, fontSize: 38, fontWeight: 800, lineHeight: 1, ...tabular}}>
                  {value}
                </Box>
                {extra > 0 && (
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, opacity: 0.85, whiteSpace: "nowrap", ...tabular}}>
                    +{extra} zvanja
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
