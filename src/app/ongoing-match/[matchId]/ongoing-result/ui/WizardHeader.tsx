"use client";

import useResultStore from "@/app/_store/game/resultStore";
import useRoundStore from "@/app/_store/RoundStore";
import {Eyebrow} from "@/app/_ui/sp";
import {TeamValueBoxes} from "@/app/ongoing-match/ui/WizardParts";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import {useEffect} from "react";
import {zvanjaPoints} from "@/app/_lib/game/scoring";

// The two team boxes pick which team the zvanja (the Zvanja step) or the points (Igra) are entered for. On Igra the box
// holds the points, and its strip the team's zvanja and its total with them (a table "bez zvanja" and a custom hand
// have no strip: their points are the total).
export default function WizardHeader() {
  const sides = useMatchSides();
  const result = useResultStore((s) => s.resultData);
  const setActiveTeam = useResultStore((s) => s.setActiveTeam);
  const declarations = useRoundStore((s) => s.roundData?.declarations) ?? true;
  const onZvanja = usePathname()?.endsWith("/zvanja") ?? false;
  const label = onZvanja ? "Zvanja" : "Igra";

  // each step starts with the viewer's team selected
  useEffect(() => {
    setActiveTeam(sides.key(sides.left));
  }, [onZvanja, sides.left]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = result.activeTeam === "team2" ? 2 : 1;
  const zvanja = (side: 1 | 2) => zvanjaPoints(result.zvanja?.[side === 1 ? "team1" : "team2"] ?? {3: 0, 4: 0});
  const points = (side: 1 | 2) => (side === 1 ? result.team1_game_points : result.team2_game_points) ?? 0;
  const [left, right] = sides.sides;
  const strip = !onZvanja && declarations && !result.custom;

  return (
    <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none", viewTransitionName: "team-header"}}>
      <Eyebrow sx={{px: "4px"}}>
        {result.result_id ? "Uredi igru" : "Nova igra"} · {label}
      </Eyebrow>
      <TeamValueBoxes
        names={sides.names}
        label={label}
        values={onZvanja ? [zvanja(left), zvanja(right)] : [points(left), points(right)]}
        zvanja={strip ? [zvanja(left), zvanja(right)] : null}
        active={sides.sides.indexOf(active) === 1 ? 1 : 0}
        onPick={(i) => setActiveTeam(sides.key(sides.sides[i]))}
      />
    </Box>
  );
}
