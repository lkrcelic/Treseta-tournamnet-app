import {color, ease, font, shadow} from "@/app/_styles/tokens";
import {Box, Drawer} from "@mui/material";
import React, {useId} from "react";

// Bottom sheet with a grabber and a title. MUI Drawer gives focus trap, Escape and scrim click to close.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      transitionDuration={{enter: 260, exit: 200}}
      SlideProps={{easing: {enter: ease, exit: "cubic-bezier(.4,0,.6,1)"}}}
      slotProps={{backdrop: {sx: {background: color.scrim}}}}
      PaperProps={{
        role: "dialog",
        "aria-labelledby": titleId,
        sx: {
          maxWidth: 560,
          mx: "auto",
          borderRadius: "28px 28px 0 0",
          background: color.card,
          boxShadow: shadow.sheet,
          p: "10px 16px calc(24px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        },
      }}
    >
      <Box aria-hidden sx={{alignSelf: "center", width: 40, height: 5, borderRadius: "3px", background: color.switchOff, mb: "10px"}} />
      <Box component="h2" id={titleId} sx={{m: 0, px: "8px", pb: "8px", fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
        {title}
      </Box>
      {children}
    </Drawer>
  );
}
