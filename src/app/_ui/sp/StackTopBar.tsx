"use client";

import type {NavStackControls} from "@/app/_lib/navStack";
import {color} from "@/app/_styles/tokens";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {ellipsis, mergeSx} from "./base";
import {IconCircleButton} from "./Buttons";

// The phone top bar of a stacked page (Team, Player, a league opened from a team; Profiles P:28-32): Back when there
// is an in-app page to return to, the page kind as a navy eyebrow ("EKIPA"), and Home. It sits 14 px from the screen
// edges, 6 px wider than the Screen's 20 px gutter, so the eyebrow lines up with the cards below.
export function StackTopBar({eyebrow, nav, sx}: {eyebrow: React.ReactNode; nav: NavStackControls; sx?: SxProps<Theme>}) {
  return (
    <Box component="header" sx={mergeSx({flex: "none", display: "flex", alignItems: "center", gap: "10px", mx: "-6px", minHeight: 44}, sx)}>
      {nav.canGoBack && (
        <IconCircleButton label="Natrag" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 26}}}>
          <ChevronLeftRoundedIcon />
        </IconCircleButton>
      )}
      <Box
        component="span"
        sx={{flex: 1, minWidth: 0, pl: "6px", fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy, ...ellipsis}}
      >
        {eyebrow}
      </Box>
      <IconCircleButton label="Početna" size={44} onClick={nav.home} sx={{"& svg": {fontSize: 22}}}>
        <HomeRoundedIcon />
      </IconCircleButton>
    </Box>
  );
}
