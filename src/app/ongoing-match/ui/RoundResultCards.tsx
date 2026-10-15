"use client";

import {NOUN, plural} from "@/app/_lib/ui/text";
import {color, font, teamColor, teamTint} from "@/app/_styles/tokens";
import {Card, tabular, VisuallyHidden} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React from "react";

// "Kraj kola": the round's wins of each team (the winner's card tinted, its number pulsing) and every match's score.
// Left is green, right red. Shared by the players' Kraj kola and the admin's phone scorepad (admin-mobile 29).
export default function RoundResultCards({
  names,
  wins,
  matches,
  big = false,
}: {
  names: readonly [string, string] | string[];
  wins: [number, number];
  matches: {id?: number; left: number; right: number}[];
  // the desktop's size
  big?: boolean;
}) {
  const winner = wins[0] !== wins[1] ? (wins[0] > wins[1] ? 0 : 1) : null;
  return (
    <>
      <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
        {([0, 1] as const).map((i) => (
          <Card
            key={i}
            sx={{position: "relative", overflow: "hidden", height: big ? 260 : 220, borderRadius: "24px", p: "18px", display: "flex", flexDirection: "column", justifyContent: "space-between"}}
          >
            <Box aria-hidden sx={{position: "absolute", inset: 0, background: teamTint[i], opacity: winner === i ? 1 : 0, transition: "opacity 500ms ease"}} />
            <Box component="h2" sx={{position: "relative", m: 0, fontSize: 16, fontWeight: 600, overflowWrap: "anywhere"}}>
              {names[i]}
            </Box>
            <Box
              sx={{
                position: "relative",
                fontFamily: font.display,
                fontSize: big ? 144 : 120,
                fontWeight: 800,
                lineHeight: 0.8,
                color: teamColor[i],
                transformOrigin: "left bottom",
                animation: winner === i ? "spPulse 760ms ease-in-out 2" : "none",
              }}
            >
              {wins[i]}
              <VisuallyHidden> {plural(wins[i], ...NOUN.pobjeda)}</VisuallyHidden>
            </Box>
          </Card>
        ))}
      </Box>
      <Card component="ol" aria-label="Mečevi" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden"}}>
        {matches.map((m, i) => (
          <Box
            component="li"
            key={m.id ?? i}
            sx={{height: 56, display: "grid", gridTemplateColumns: "90px 1fr 1fr", alignItems: "center", px: "16px", borderBottom: `1px solid ${color.line}`}}
          >
            <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: color.muted}}>
              Meč {i + 1}
            </Box>
            {[m.left, m.right].map((v, k) => (
              <Box key={k} component="span" sx={{textAlign: "center", fontFamily: font.display, fontSize: 24, fontWeight: 700, ...tabular}}>
                {v}
              </Box>
            ))}
          </Box>
        ))}
        {matches.length === 0 && (
          <Box component="li" sx={{p: "18px 16px", color: color.muted, fontSize: 15}}>
            Nema odigranih mečeva.
          </Box>
        )}
      </Card>
    </>
  );
}
