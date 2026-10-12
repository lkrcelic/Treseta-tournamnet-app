"use client";

import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, shadow} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box, useMediaQuery} from "@mui/material";
import React from "react";
import {PrimaryButton} from "./Buttons";
import {Screen} from "./Screen";
import {Display} from "./Text";

// An admin screen opened on a phone (Novo kolo, Upravljanje ligom, Nova liga, Ekipe, the admin scorepad). Admins
// manage everything on the desktop (handoff §2), so the phone only says so and leads back to Početna. A computer
// whose browser window is narrower than the desktop layout gets the same screen, so with a mouse it also says to
// widen the window.
export function DesktopOnlyNote() {
  const router = useTransitionRouter();
  const mouse = useMediaQuery("(hover: hover) and (pointer: fine)", {noSsr: true});
  return (
    <Screen>
      <Box sx={{px: "4px", pb: "4px"}}>
        <Brand variant="home" />
      </Box>
      <Box sx={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", px: "12px", textAlign: "center"}}>
        <Box
          aria-hidden
          sx={{width: 64, height: 64, borderRadius: "50%", background: color.white, color: color.navy, boxShadow: shadow.raised, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 32}}}
        >
          <ComputerRoundedIcon />
        </Box>
        <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"}}>
          <Display size={24} sx={{maxWidth: 300, lineHeight: 1.15, letterSpacing: "-.01em", color: color.ink, textWrap: "balance"}}>
            Ovo se uređuje na računalu.
          </Display>
          {mouse && <Box sx={{maxWidth: 300, fontSize: 15, lineHeight: 1.4, color: color.muted, textWrap: "balance"}}>Prozor preglednika je preuzak, raširi ga.</Box>}
        </Box>
      </Box>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
    </Screen>
  );
}
