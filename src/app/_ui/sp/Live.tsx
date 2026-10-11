import {color} from "@/app/_styles/tokens";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {mergeSx, tabular} from "./base";

// Red dot marking something that is being played right now
export function LiveDot({size = 8, pulse = true, label, sx}: {size?: number; pulse?: boolean; label?: string; sx?: SxProps<Theme>}) {
  return (
    <Box
      component="span"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      sx={mergeSx(
        {
          display: "inline-block",
          flex: "none",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color.live,
          animation: pulse ? "spLive 1.5s infinite" : "none",
        },
        sx
      )}
    />
  );
}

// "LIVE: 2" / "LIVE" filled pill
export function LivePill({children, sx}: {children?: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      component="span"
      sx={mergeSx(
        {
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          px: "10px",
          borderRadius: "14px",
          background: color.live,
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".04em",
          flex: "none",
        },
        sx
      )}
    >
      <Box component="span" sx={{width: 7, height: 7, borderRadius: "50%", background: "#FFFFFF"}} />
      {children ?? "LIVE"}
    </Box>
  );
}

// "● LIVE" red text label on a table card
export function LiveLabel({sx}: {sx?: SxProps<Theme>}) {
  return (
    <Box
      component="span"
      sx={mergeSx({display: "inline-flex", alignItems: "center", gap: "6px", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: color.live}, sx)}
    >
      <LiveDot />
      LIVE
    </Box>
  );
}

// Rank circle in standings; red and pulsing while the team is playing
export function RankBadge({rank, live = false, size = 28}: {rank: number; live?: boolean; size?: number}) {
  return (
    <Box
      component="span"
      aria-label={live ? `${rank}. mjesto, igra uživo` : `${rank}. mjesto`}
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 30 ? 14 : size >= 28 ? 14 : 12,
        fontWeight: 700,
        ...tabular,
        color: live ? "#FFFFFF" : color.navy,
        background: live ? color.live : color.paper,
        animation: live ? "spLive 1.5s infinite" : "none",
      }}
    >
      {rank}
    </Box>
  );
}
