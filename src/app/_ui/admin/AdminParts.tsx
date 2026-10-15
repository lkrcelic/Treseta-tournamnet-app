"use client";

import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, tabular} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box} from "@mui/material";

// Small parts of the admin's phone screens (admin-mobile design)

// A white card of a phone admin screen: 22 px corners, 16 px inside
export const adminCardSx = {flex: "none", background: color.white, borderRadius: "22px", p: "16px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: shadow.card} as const;

// A field's label in an admin card
export const adminLabelSx = {fontSize: 15, fontWeight: 600, color: color.ink} as const;

// − 8 + on a beige track (Veličina prozora, Kola po večeri); step: how much a press changes it
export function PhoneStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  less,
  more,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  // what the − and + say to a screen reader
  less: string;
  more: string;
}) {
  const btn = {
    ...buttonBase,
    width: 48,
    height: 44,
    flex: "none",
    borderRadius: "12px",
    background: color.white,
    color: color.navy,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow.raised,
    "&:disabled": {opacity: 0.4},
    "& svg": {fontSize: 24},
  } as const;
  return (
    <Box role="group" aria-label={label} sx={{display: "flex", alignItems: "center", gap: "8px", p: "4px", borderRadius: "16px", background: color.lineFill}}>
      <Box component="button" type="button" aria-label={less} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} sx={btn}>
        <RemoveRoundedIcon />
      </Box>
      <Box component="span" aria-live="polite" sx={{flex: 1, textAlign: "center", fontFamily: font.display, fontSize: 26, fontWeight: 800, ...tabular}}>
        {value}
      </Box>
      <Box component="button" type="button" aria-label={more} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} sx={btn}>
        <AddRoundedIcon />
      </Box>
    </Box>
  );
}

// Pon … Ned, one at most; a press on the picked day takes it back (the play day is optional)
export function DayPicker({value, onChange, labelId}: {value: number | null; onChange: (day: number | null) => void; labelId: string}) {
  const days = ["pon", "uto", "sri", "čet", "pet", "sub", "ned"];
  const names = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];
  return (
    <Box role="radiogroup" aria-labelledby={labelId} sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: "4px", p: "4px", borderRadius: "16px", background: color.lineFill}}>
      {days.map((d, i) => {
        const on = value === i;
        return (
          <Box
            key={d}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={names[i]}
            onClick={() => onChange(on ? null : i)}
            sx={{
              ...buttonBase,
              height: 44,
              minWidth: 0,
              borderRadius: "12px",
              background: on ? color.white : "transparent",
              color: on ? color.ink : color.ink2,
              boxShadow: on ? shadow.segment : "none",
              fontSize: 14,
              fontWeight: on ? 700 : 600,
            }}
          >
            {d}
          </Box>
        );
      })}
    </Box>
  );
}
