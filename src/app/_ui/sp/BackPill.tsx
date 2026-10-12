"use client";

import type {NavStackControls} from "@/app/_lib/navStack";
import {color, shadow} from "@/app/_styles/tokens";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import {Box, SxProps, Theme} from "@mui/material";
import {buttonBase, ellipsis, mergeSx} from "./base";

// The desktop Back of a stacked page (Profiles P:172-174): a white pill naming the page it returns to ("‹ Puleni"),
// "Natrag" when that page gave no name. Nothing when there is no in-app page to return to.
export function BackPill({nav, sx}: {nav: NavStackControls; sx?: SxProps<Theme>}) {
  if (!nav.canGoBack) return null;
  return (
    <Box
      component="button"
      type="button"
      onClick={nav.back}
      aria-label={nav.previousLabel ? `Natrag: ${nav.previousLabel}` : "Natrag"}
      sx={mergeSx(
        buttonBase,
        {
          alignSelf: "flex-start",
          flex: "none",
          maxWidth: "100%",
          height: 44,
          p: "0 14px 0 6px",
          borderRadius: "22px",
          background: color.white,
          color: color.navy,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: shadow.raised,
          transition: "box-shadow 160ms ease",
          "&:hover": {boxShadow: shadow.cardHover},
          "& svg": {fontSize: 26, flex: "none"},
        },
        sx
      )}
    >
      <ChevronLeftRoundedIcon aria-hidden />
      <Box component="span" sx={{minWidth: 0, ...ellipsis}}>
        {nav.previousLabel ?? "Natrag"}
      </Box>
    </Box>
  );
}
