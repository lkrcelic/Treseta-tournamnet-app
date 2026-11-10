"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import {Display, StackTopBar} from "@/app/_ui/sp";
import PlayerFrame from "@/app/_ui/tournaments/PlayerFrame";
import TournamentsOverview from "@/app/_ui/tournaments/TournamentsOverview";
import {Box} from "@mui/material";

// Turniri on its own (the desktop menu, a shared link): what Početna's Turniri tab shows, without Burza igrača. Public.
export default function TournamentsPage() {
  const nav = useNavStack("Turniri", "/");
  return (
    <PlayerFrame>
      <StackTopBar eyebrow="Turniri" nav={nav} />
      <Box sx={{px: "4px"}}>
        <Display size={34}>Turniri</Display>
      </Box>
      <TournamentsOverview />
    </PlayerFrame>
  );
}
