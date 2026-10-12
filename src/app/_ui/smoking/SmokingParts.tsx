"use client";

import {color, tint} from "@/app/_styles/tokens";
import {mergeSx, Segmented} from "@/app/_ui/sp";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {Box, SxProps, Theme} from "@mui/material";

// Smokers and smoking tables (Claude Design "Pušači i pušački stolovi")

export const SMOKER_HINT = "Pušače smještamo za stolove gdje se smije pušiti. Možeš promijeniti na profilu.";

// "Pušiš li?" Ne / Da, right after the birth date at sign-up
export function SmokerChoice({value, onChange, size = 44}: {value: boolean; onChange: (smoker: boolean) => void; size?: number}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
      <Box aria-hidden sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
        Pušiš li?
      </Box>
      <Segmented
        variant="track"
        asTabs={false}
        label="Pušiš li?"
        size={size}
        value={value ? "da" : "ne"}
        onChange={(k) => onChange(k === "da")}
        items={[
          {key: "ne", label: <Box component="span" sx={{fontSize: 16}}>Ne</Box>},
          {
            key: "da",
            label: (
              <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 16, "& svg": {fontSize: 20, color: color.navy}}}>
                <SmokingRoomsRoundedIcon aria-hidden />
                Da
              </Box>
            ),
          },
        ]}
      />
      <Box sx={{pl: "4px", fontSize: 13, lineHeight: 1.4, color: color.muted}}>{SMOKER_HINT}</Box>
    </Box>
  );
}

// The mark of a smoking table: "onNavy" next to STOL on Početna's card, "dot" next to "Table 3" in a round, "badge"
// on the corner of the desktop table number
export function SmokingMark({variant = "dot", sx}: {variant?: "onNavy" | "dot" | "badge"; sx?: SxProps<Theme>}) {
  const look = {
    onNavy: {width: 28, height: 28, borderRadius: "9px", border: `1.5px solid ${tint.creamOnNavy[55]}`, color: color.cream, icon: 18},
    dot: {width: 24, height: 24, borderRadius: "50%", background: color.cream, color: color.navy, icon: 16},
    badge: {width: 18, height: 18, borderRadius: "50%", background: color.cream, color: color.navy, boxShadow: `0 0 0 2px ${color.white}`, icon: 12},
  }[variant];
  const {icon, ...box} = look;
  return (
    <Box
      component="span"
      role="img"
      title="Pušački stol"
      aria-label="Pušački stol"
      sx={mergeSx({flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", "& svg": {fontSize: icon}}, box, sx)}
    >
      <SmokingRoomsRoundedIcon aria-hidden />
    </Box>
  );
}
