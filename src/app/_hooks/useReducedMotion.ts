"use client";

import {useMediaQuery} from "@mui/material";

export default function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", {noSsr: true});
}
