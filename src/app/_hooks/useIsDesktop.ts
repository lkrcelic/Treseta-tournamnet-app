"use client";

import {DESKTOP_MIN_WIDTH} from "@/app/_styles/tokens";
import {useMediaQuery} from "@mui/material";

// true from the desktop breakpoint up; pages are client-rendered, so the first render already knows the width
export default function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width:${DESKTOP_MIN_WIDTH}px)`, {noSsr: true});
}
