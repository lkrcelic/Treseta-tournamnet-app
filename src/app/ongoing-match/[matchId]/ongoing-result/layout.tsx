"use client";

import {Box} from "@mui/material";
import React from "react";
import TeamsScoreSection from "@/app/ongoing-match/[matchId]/ongoing-result/ui/TeamsScoreSection";

export default function Layout({children}) {
  return (
    <>
      <Box sx={{gridArea: "top", alignSelf: "end"}}>
        <TeamsScoreSection/>
      </Box>
      {children}
    </>
  );
}

