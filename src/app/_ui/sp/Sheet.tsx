import {color, ease, font, shadow, tint} from "@/app/_styles/tokens";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {Box, Drawer} from "@mui/material";
import React, {useId} from "react";
import {IconCircleButton} from "./Buttons";

// Bottom sheet with a grabber and a title. MUI Drawer gives focus trap, Escape and scrim click to close.
// paper: the paper background with a close button next to the title (Burza · Što objavljuješ?).
export function BottomSheet({
  open,
  onClose,
  title,
  paper = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  paper?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const heading = (
    <Box component="h2" id={titleId} sx={{m: 0, px: paper ? 0 : "8px", pb: paper ? 0 : "8px", fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
      {title}
    </Box>
  );
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      transitionDuration={{enter: 260, exit: 200}}
      SlideProps={{easing: {enter: ease, exit: "cubic-bezier(.4,0,.6,1)"}}}
      slotProps={{backdrop: {sx: {background: paper ? tint.scrim[42] : tint.scrim[32]}}}}
      PaperProps={{
        role: "dialog",
        "aria-labelledby": titleId,
        sx: {
          maxWidth: 560,
          mx: "auto",
          borderRadius: "28px 28px 0 0",
          background: paper ? color.paper : color.white,
          boxShadow: shadow.sheet,
          p: paper ? "10px 20px calc(24px + env(safe-area-inset-bottom))" : "10px 16px calc(24px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: paper ? "12px" : "4px",
        },
      }}
    >
      <Box aria-hidden sx={{alignSelf: "center", width: paper ? 36 : 40, height: 5, borderRadius: "3px", background: color.hairline, mb: paper ? 0 : "10px"}} />
      {paper ? (
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
          {heading}
          <IconCircleButton label="Zatvori" size={44} onClick={onClose} sx={{boxShadow: "none", "& svg": {fontSize: 22}}}>
            <CloseRoundedIcon />
          </IconCircleButton>
        </Box>
      ) : (
        heading
      )}
      {children}
    </Drawer>
  );
}
