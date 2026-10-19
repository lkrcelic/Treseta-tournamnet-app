"use client";

import {color, crop as cropColor} from "@/app/_styles/tokens";
import {buttonBase, InitialsAvatar} from "@/app/_ui/sp";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {Box, Dialog, Fade, SxProps, Theme} from "@mui/material";
import React, {useId, useState} from "react";
import type {PhotoKind} from "./PhotoParts";

// A profile photo over the whole screen, in the dress of "Pomakni i zumiraj" (M3): the black screen, the name and
// "Profilna slika" / "Slika ekipe" on top with ✕ on the left, and the photo in its circle with the white rim, as wide as
// the screen lets it (at most the photo's own 512 px). A tap anywhere, ✕, Esc or Back closes it.
export function PhotoViewer({kind, name, src, onClose}: {kind: PhotoKind; name: string; src: string; onClose: () => void}) {
  const titleId = useId();
  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      TransitionComponent={Fade}
      aria-labelledby={titleId}
      PaperProps={{sx: {background: cropColor.stage, color: color.white, display: "flex", flexDirection: "column"}}}
    >
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 56px", alignItems: "center", p: "calc(10px + env(safe-area-inset-top)) 8px 10px"}}>
        <Box
          component="button"
          type="button"
          aria-label="Zatvori"
          onClick={onClose}
          sx={{...buttonBase, width: 44, height: 44, borderRadius: "22px", display: "flex", alignItems: "center", justifyContent: "center", color: color.white, background: cropColor.pill, "& svg": {fontSize: 24}}}
        >
          <CloseRoundedIcon />
        </Box>
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", textAlign: "center"}}>
          <Box component="h2" id={titleId} sx={{m: 0, maxWidth: "100%", fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
            {name}
          </Box>
          <Box component="span" sx={{fontSize: 13, color: cropColor.rim, opacity: 0.7}}>
            {kind === "team" ? "Slika ekipe" : "Profilna slika"}
          </Box>
        </Box>
      </Box>
      {/* a tap beside the photo or on it closes the screen, as in a phone's gallery */}
      <Box onClick={onClose} sx={{flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", p: "16px 16px calc(56px + env(safe-area-inset-bottom))"}}>
        <Box
          component="img"
          src={src}
          alt={kind === "team" ? `Slika ekipe ${name}` : `Profilna slika: ${name}`}
          draggable={false}
          onError={onClose}
          sx={{
            width: "min(100%, 512px, calc(100dvh - 200px))",
            aspectRatio: "1",
            borderRadius: "50%",
            objectFit: "cover",
            boxShadow: `0 0 0 1.5px ${cropColor.rim}`,
            background: cropColor.stageSoft,
            userSelect: "none",
            animation: "photo-viewer-in 220ms cubic-bezier(.2,.8,.2,1)",
            "@keyframes photo-viewer-in": {from: {transform: "scale(.6)", opacity: 0}, to: {transform: "none", opacity: 1}},
            "@media (prefers-reduced-motion: reduce)": {animation: "none"},
          }}
        />
      </Box>
    </Dialog>
  );
}

// An avatar that opens its photo over the whole screen (PhotoViewer); with no photo it is the plain initials circle
export function ViewableAvatar({
  kind,
  name,
  letters,
  src,
  size,
  variant = "navy",
  sx,
}: {
  kind: PhotoKind;
  name: string;
  letters?: string;
  src?: string | null;
  size: number;
  variant?: React.ComponentProps<typeof InitialsAvatar>["variant"];
  sx?: SxProps<Theme>;
}) {
  const [open, setOpen] = useState(false);
  const avatar = <InitialsAvatar name={name} letters={letters} src={src} size={size} variant={variant} sx={sx} />;
  if (!src) return avatar;
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={kind === "team" ? `Prikaži sliku ekipe ${name}` : `Prikaži profilnu sliku: ${name}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        sx={{
          ...buttonBase,
          flex: "none",
          width: size,
          height: size,
          borderRadius: "50%",
          cursor: "zoom-in",
          transition: "transform 150ms ease",
          "&:active": {transform: "scale(.96)"},
          "&:focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "3px"},
        }}
      >
        {avatar}
      </Box>
      {open && <PhotoViewer kind={kind} name={name} src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
