"use client";

import {SHORT_WINDOW} from "@/app/_ui/sp/base";
import {useMediaQuery} from "@mui/material";

// true in a desktop window under 800 px high (a 1024×640 laptop): header cards, back pills and the scorepad's header go
// compact, so the columns under them keep room for their rows
export default function useShortWindow(): boolean {
  return useMediaQuery(SHORT_WINDOW, {noSsr: true});
}
