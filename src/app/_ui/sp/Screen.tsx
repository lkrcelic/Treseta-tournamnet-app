import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {mergeSx} from "./base";

// Phone screen frame: paper background, 20 px gutters, safe-area aware.
// fill: the screen is exactly one viewport tall and a child list scrolls inside it (standings, scoreboard).
export function Screen({
  children,
  fill = false,
  gap = 14,
  sx,
  component = "main",
}: {
  children: React.ReactNode;
  fill?: boolean;
  gap?: number;
  sx?: SxProps<Theme>;
  component?: React.ElementType;
}) {
  return (
    <Box
      component={component}
      sx={mergeSx(
        {
          display: "flex",
          flexDirection: "column",
          gap: `${gap}px`,
          width: "100%",
          maxWidth: 560,
          mx: "auto",
          px: "20px",
          pt: "calc(20px + env(safe-area-inset-top))",
          pb: "calc(24px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          ...(fill ? {height: "100dvh", overflow: "hidden"} : {minHeight: "100dvh"}),
        },
        sx
      )}
    >
      {children}
    </Box>
  );
}

// Takes the remaining height of a fill screen and scrolls its content
export function ScrollArea({children, sx, bleed = false}: {children: React.ReactNode; sx?: SxProps<Theme>; bleed?: boolean}) {
  return (
    <Box
      sx={mergeSx(
        {
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          ...(bleed ? {mx: "-20px", px: "20px", pb: "4px"} : {}),
        },
        sx
      )}
    >
      {children}
    </Box>
  );
}
