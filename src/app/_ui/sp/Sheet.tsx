import useKeyboardInset from "@/app/_hooks/useKeyboardInset";
import {color, ease, font, shadow, tint} from "@/app/_styles/tokens";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {Box, Drawer} from "@mui/material";
import React, {useId} from "react";
import {IconCircleButton} from "./Buttons";

// Bottom sheet with a grabber and a title. MUI Drawer gives focus trap, Escape and scrim click to close.
// paper: the paper background with a close button next to the title (Burza · Što objavljuješ?).
// closable: the admin's white sheets (admin-mobile design): a close button next to the title, 20 px gutters and 14 px
// between the parts. busy: something the sheet started is on its way, so it can't be closed until it answers.
// tall: the sheet is 88% of the screen high whatever it holds, and stays above the on-screen keyboard (it moves up by
// the keyboard and shrinks to what is left above it); the caller lets one part take the remaining height and scroll
// (a list) and keeps its search field last, so the field is right above the keyboard (Tko igra večeras?).
export function BottomSheet({
  open,
  onClose,
  title,
  paper = false,
  closable = false,
  busy = false,
  tall = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  paper?: boolean;
  closable?: boolean;
  busy?: boolean;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const keyboard = useKeyboardInset(open && tall);
  const close = () => {
    if (!busy) onClose();
  };
  const withClose = paper || closable;
  const heading = (
    <Box
      component="h2"
      id={titleId}
      sx={{
        m: 0,
        px: withClose ? 0 : "8px",
        pb: withClose ? 0 : "8px",
        minWidth: 0,
        fontFamily: font.display,
        fontSize: 24,
        fontWeight: 800,
        ...(closable && {letterSpacing: "-.01em", lineHeight: 1.15, textWrap: "pretty"}),
      }}
    >
      {title}
    </Box>
  );
  const kb = keyboard.visible != null;
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={close}
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
          p: withClose ? "10px 20px calc(24px + env(safe-area-inset-bottom))" : "10px 16px calc(24px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: closable ? "14px" : paper ? "12px" : "4px",
          ...(tall && {
            boxSizing: "border-box",
            height: kb ? `${keyboard.visible! - 8}px` : "88dvh",
            bottom: `${keyboard.inset}px`,
            // the keyboard covers the home indicator
            ...(kb && {pb: "12px"}),
            overflow: "hidden",
          }),
        },
      }}
    >
      <Box aria-hidden sx={{flex: "none", alignSelf: "center", width: withClose ? 36 : 40, height: 5, borderRadius: "3px", background: color.hairline, mb: withClose ? 0 : "10px"}} />
      {withClose ? (
        <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
          {heading}
          <IconCircleButton
            label="Zatvori"
            size={44}
            onClick={close}
            disabled={busy}
            sx={{boxShadow: "none", ...(closable && {background: color.paper}), "& svg": {fontSize: 22}}}
          >
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
