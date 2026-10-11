import {color, font} from "@/app/_styles/tokens";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {ellipsis, mergeSx} from "./base";
import {IconCircleButton} from "./Buttons";

// Compact phone header (Burza, Oglas, Raspored): a 44 px round back button, a navy eyebrow and a 28 px title,
// with an optional button on the right
export function TopBar({
  eyebrow,
  title,
  onBack,
  backLabel = "Natrag",
  backIcon,
  right,
  sx,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  // the chevron unless given (Burza goes Home with a house)
  backIcon?: React.ReactNode;
  right?: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box component="header" sx={mergeSx({flex: "none", display: "flex", alignItems: "center", gap: "12px"}, sx)}>
      {onBack && (
        <IconCircleButton label={backLabel} size={44} onClick={onBack} sx={{"& svg": {fontSize: backIcon ? 24 : 26}}}>
          {backIcon ?? <ChevronLeftRoundedIcon />}
        </IconCircleButton>
      )}
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
        {eyebrow && <Box sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy, ...ellipsis}}>{eyebrow}</Box>}
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em"}}>
          {title}
        </Box>
      </Box>
      {right}
    </Box>
  );
}
