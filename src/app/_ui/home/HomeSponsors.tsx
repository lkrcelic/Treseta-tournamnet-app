"use client";

import {useLeagueSponsors} from "@/app/_hooks/useSponsors";
import {SponsorPublic} from "@/app/_interfaces/sponsor";
import {color, shadow} from "@/app/_styles/tokens";
import {SponsorBand, SponsorSheet, useSponsorViews} from "@/app/_ui/sponsors/SponsorParts";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import {Box} from "@mui/material";
import {useState} from "react";

// Sponzori lige on Početna (Claude Design "Sponzori ekrani" S1–S2): the league's sponsors slide slowly under the
// tiles, and a logo opens its sponsor's card. A league without sponsors shows nothing here.
export default function HomeSponsors({leagueId}: {leagueId: number | null | undefined}) {
  const sponsors = useLeagueSponsors(leagueId);
  const [open, setOpen] = useState<SponsorPublic | null>(null);
  useSponsorViews(leagueId, sponsors);
  if (!sponsors?.length) return null;
  return (
    <Box component="section" aria-label="Sponzori lige" sx={{flex: "none", background: color.white, borderRadius: "22px", boxShadow: shadow.card, p: "14px 0 16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden"}}>
      <Box component="h2" sx={{m: 0, px: "16px", display: "flex", alignItems: "center", gap: "6px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy, "& svg": {fontSize: 20}}}>
        <HandshakeOutlinedIcon aria-hidden />
        Sponzori lige
      </Box>
      <SponsorBand sponsors={sponsors} height={56} gap={20} onOpen={setOpen} />
      <SponsorSheet sponsor={open} leagueId={leagueId} onClose={() => setOpen(null)} />
    </Box>
  );
}
