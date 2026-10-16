"use client";

import {SponsorPublic} from "@/app/_interfaces/sponsor";
import {color, tint} from "@/app/_styles/tokens";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import {Box} from "@mui/material";
import {useState} from "react";
import {SponsorBand, SponsorDialog, useSponsorViews} from "./SponsorParts";

// The sponsors along the bottom of a live round on the admin's computer (Dnevni poredak on a round's tab, which the
// bar shows on its screen; Claude Design "Sponzori ekrani" D1–D2): "Sponzori lige" on the left, then the logos
// sliding slowly; a logo opens its sponsor's card in the middle of the screen.
export default function LiveRoundSponsors({leagueId, sponsors}: {leagueId: number; sponsors: SponsorPublic[]}) {
  const [open, setOpen] = useState<SponsorPublic | null>(null);
  useSponsorViews(leagueId, sponsors);
  return (
    <Box
      component="section"
      aria-label="Sponzori lige"
      sx={{height: 96, display: "flex", alignItems: "center", background: color.white, borderTop: `1px solid ${tint.navy[10]}`}}
    >
      <Box
        component="h2"
        sx={{
          m: 0,
          flex: "none",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          p: "0 28px 0 36px",
          borderRight: `1px solid ${tint.navy[10]}`,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: color.navy,
          "& svg": {fontSize: 24},
        }}
      >
        <HandshakeOutlinedIcon aria-hidden />
        Sponzori lige
      </Box>
      <SponsorBand sponsors={sponsors} height={60} gap={48} fade={96} onOpen={setOpen} sx={{flex: 1, alignSelf: "stretch", display: "flex", alignItems: "center"}} />
      <SponsorDialog sponsor={open} leagueId={leagueId} onClose={() => setOpen(null)} />
    </Box>
  );
}
