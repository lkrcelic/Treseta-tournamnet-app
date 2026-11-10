"use client";

import {Screen} from "@/app/_ui/sp";
import WizardHeader from "@/app/ongoing-match/[matchId]/ongoing-result/ui/WizardHeader";
import {activeNavDirection} from "@/app/_lib/viewTransitions";
import {Box} from "@mui/material";
import React, {useState} from "react";

// Hand entry frame: the two team boxes on top, the step below. Two steps, Zvanja (not at a table "bez zvanja") and Igra
// (the Bela app has three: trump caller, zvanja, game points).
export default function Layout({children}: {children: React.ReactNode}) {
  // a view transition already slides the page in; the CSS slide is the fallback (older browsers, browser back button)
  const [viaViewTransition] = useState(() => activeNavDirection() != null);

  return (
    <Screen fill gap={0} sx={{pt: "calc(22px + env(safe-area-inset-top))"}}>
      <WizardHeader />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          animation: viaViewTransition ? "none" : "spStepIn 280ms cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        {children}
      </Box>
    </Screen>
  );
}
