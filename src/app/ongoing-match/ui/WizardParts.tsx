"use client";

import {color, ease, font, shadow, teamColor} from "@/app/_styles/tokens";
import {buttonBase, tabular} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import {Box} from "@mui/material";
import React from "react";

// The parts of the hand entry steps (Claude Design ScorepadPhone: trump, zvanja, score), shared by the players' wizard
// and the admin's phone scorepad (admin-mobile 26–28). They only draw; the caller keeps the hand. Index 0 is the left
// team (green), 1 the right one (red).

export const ZVANJA_VALUES = [20, 50, 100, 150, 200] as const;

// Step 1: the two big team cards, one picked as the caller
export function CallerCards({names, caller, onPick, disabled}: {names: readonly [string, string] | string[]; caller: 0 | 1 | null; onPick: (i: 0 | 1) => void; disabled?: boolean}) {
  return (
    <Box role="radiogroup" aria-label="Tko je zvao" sx={{flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignContent: "center", py: "16px"}}>
      {([0, 1] as const).map((i) => {
        const on = caller === i;
        return (
          <Box
            key={i}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onPick(i)}
            sx={{
              ...buttonBase,
              position: "relative",
              height: 200,
              borderRadius: "24px",
              border: `2.5px solid ${teamColor[i]}`,
              background: color.white,
              overflow: "hidden",
              animation: on ? "spSel 420ms cubic-bezier(.3,1.4,.5,1)" : "none",
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 270,
                height: 270,
                borderRadius: "50%",
                background: teamColor[i],
                transform: `translate(-50%,-50%) scale(${on ? 1 : 0})`,
                transition: `transform 360ms ${ease}`,
              }}
            />
            <Box
              sx={{
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                px: "10px",
                color: on ? color.white : teamColor[i],
                transition: "color 200ms ease",
              }}
            >
              <CheckCircleRoundedIcon
                aria-hidden
                sx={{
                  fontSize: 34,
                  opacity: on ? 1 : 0,
                  transform: on ? "scale(1)" : "scale(.4)",
                  transition: "opacity 200ms ease 120ms, transform 300ms cubic-bezier(.3,1.5,.5,1) 120ms",
                }}
              />
              <Box component="span" sx={{fontFamily: font.display, fontSize: 22, fontWeight: 700, overflowWrap: "anywhere", textAlign: "center"}}>
                {names[i]}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// Steps 2 and 3: the two team boxes that pick which team the zvanja or points are entered for (label "Zvanja",
// "Igra"; sums: the "Σ 162" line under each box on the points step)
export function TeamValueBoxes({
  names,
  label,
  values,
  sums,
  active,
  onPick,
}: {
  names: readonly [string, string] | string[];
  label: string;
  values: [number, number];
  sums?: [number, number] | null;
  active: 0 | 1;
  onPick: (i: 0 | 1) => void;
}) {
  return (
    <Box role="radiogroup" aria-label={`${label}: upis za ekipu`} sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
      {([0, 1] as const).map((i) => {
        const on = active === i;
        return (
          <Box key={i} sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
            <Box
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${names[i]}: ${label.toLowerCase()} ${values[i]}`}
              onClick={() => onPick(i)}
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
                {label} · {names[i]}
              </Box>
              <Box component="span" sx={{fontFamily: font.display, fontSize: 38, fontWeight: 800, lineHeight: 1, ...tabular}}>
                {values[i]}
              </Box>
            </Box>
            <Box aria-live="polite" sx={{height: 18, pl: "8px", fontSize: 14, fontWeight: 600, color: color.muted, ...tabular}}>
              {sums ? `Σ ${sums[i]}` : ""}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// Step 2: the zvanja of the team picked above, with how many of each (in the team's colour) and Obriši zvanja
export function ZvanjaButtons({label, counts, team, onAdd, onClear}: {label: string; counts: Partial<Record<number, number>>; team: 0 | 1; onAdd: (v: (typeof ZVANJA_VALUES)[number]) => void; onClear: () => void}) {
  return (
    <Box role="group" aria-label={label} sx={{flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", alignContent: "center", py: "16px"}}>
      {ZVANJA_VALUES.map((v) => {
        const cnt = counts[v] ?? 0;
        return (
          <Box
            key={v}
            component="button"
            type="button"
            onClick={() => onAdd(v)}
            aria-label={`Zvanje ${v}${cnt ? `, upisano ${cnt}` : ""}`}
            sx={{
              ...buttonBase,
              position: "relative",
              height: 84,
              borderRadius: "20px",
              background: color.cream,
              color: color.navy,
              fontFamily: font.display,
              fontSize: 30,
              fontWeight: 800,
              transition: "transform 120ms ease",
              "&:active": {transform: "scale(.95)"},
            }}
          >
            {v}
            <Box
              key={`${team}-${cnt}`}
              component="span"
              aria-hidden
              sx={{
                position: "absolute",
                top: "-7px",
                right: "-7px",
                minWidth: 28,
                height: 28,
                px: "7px",
                boxSizing: "border-box",
                borderRadius: "14px",
                background: teamColor[team],
                color: color.white,
                fontFamily: font.body,
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 0 3px ${color.paper}`,
                opacity: cnt ? 1 : 0,
                transform: cnt ? "scale(1)" : "scale(.4)",
                transition: "opacity 160ms ease, transform 200ms ease, background 200ms ease",
                animation: cnt ? "spPop 320ms ease" : "none",
              }}
            >
              {cnt || ""}
            </Box>
          </Box>
        );
      })}
      <Box
        component="button"
        type="button"
        onClick={onClear}
        sx={{
          ...buttonBase,
          height: 84,
          borderRadius: "20px",
          border: `2px solid ${color.borderStrong}`,
          color: color.navy,
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.15,
          px: "8px",
          textAlign: "center",
        }}
      >
        Obriši zvanja
      </Box>
    </Box>
  );
}

// Step 3: the keypad for the picked team's points. onStiglja: the Štiglja key (left out on Ručni unos, which keeps
// its place empty); keysOff: the digits are off (after Štiglja)
export function PointsKeypad({onDigit, onStiglja, stiglja = false, onClear, keysOff = false}: {onDigit: (d: number) => void; onStiglja?: () => void; stiglja?: boolean; onClear: () => void; keysOff?: boolean}) {
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
    transition: "transform 100ms ease, opacity 200ms ease",
    "&:active:not(:disabled)": {transform: "scale(.95)", background: color.lineFill},
    "&:disabled": {opacity: 0.35},
  } as const;
  return (
    <Box sx={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", pb: "16px"}}>
      <Box role="group" aria-label="Bodovi igre" sx={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px"}}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Box key={d} component="button" type="button" onClick={() => onDigit(d)} disabled={keysOff} sx={key}>
            {d}
          </Box>
        ))}
        {onStiglja ? (
          <Box
            component="button"
            type="button"
            onClick={onStiglja}
            aria-pressed={stiglja}
            sx={{...key, background: color.cream, color: color.navy, fontFamily: font.body, fontSize: 17, boxShadow: "none"}}
          >
            Štiglja
          </Box>
        ) : (
          <span />
        )}
        <Box component="button" type="button" onClick={() => onDigit(0)} disabled={keysOff} sx={key}>
          0
        </Box>
        <Box
          component="button"
          type="button"
          onClick={onClear}
          aria-label="Obriši bodove"
          sx={{...key, background: "transparent", border: `2px solid ${color.borderStrong}`, color: color.navy, fontSize: 26, boxShadow: "none"}}
        >
          X
        </Box>
      </Box>
    </Box>
  );
}
