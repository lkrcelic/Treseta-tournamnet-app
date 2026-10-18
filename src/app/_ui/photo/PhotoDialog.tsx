"use client";

import {GOOGLE_PHOTO_PATH} from "@/app/_fetchers/photos";
import {PHOTO_CROP_START, rotatePhotoLeft} from "@/app/_lib/ui/photoCrop";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ErrorNote, IconCircleButton, OutlineButton, SolidButton} from "@/app/_ui/sp";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import Rotate90DegreesCcwRoundedIcon from "@mui/icons-material/Rotate90DegreesCcwRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import {Box, Dialog} from "@mui/material";
import React, {useId, useState} from "react";
import {CropSource, PhotoCropper, usePhotoCrop, ZoomSlider} from "./PhotoCropper";
import {PHOTO_TEXT, PhotoControls, PhotoKind, useFilePicker, VisibilityChoices} from "./PhotoParts";
import {GoogleCard} from "./PhotoSheet";

// "Profilna slika" / "Slika ekipe" on the computer (Claude Design D2, 820 px): on the left the photo in its circle with
// the zoom, Okreni and Vrati; on the right a file dropped or picked, and the Google picture as a suggestion (a team
// also picks who sees its photo here); at the bottom the bin (Makni sliku), Odustani and Spremi.
export function PhotoDialog({kind, photo, google, onClose}: {kind: PhotoKind; photo: PhotoControls; google?: {email: string} | null; onClose: () => void}) {
  const text = PHOTO_TEXT[kind];
  const {photo_url} = photo.info;
  // the saved photo, to crop again; a new file or the Google picture replaces it
  const [source] = useState<CropSource | null>(photo_url ? {src: photo_url, fresh: false} : null);
  const c = usePhotoCrop(source);
  const files = useFilePicker(c.pick);
  const [over, setOver] = useState(false);
  const titleId = useId();
  const whoId = useId();
  const busy = photo.busy;

  const save = async () => {
    const data = c.render();
    if (data && (await photo.save(data))) onClose();
  };
  const remove = async () => {
    if (await photo.remove()) onClose();
  };
  const softButton = {boxShadow: "none", background: color.paper, "& svg": {fontSize: 22}} as const;

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      maxWidth={false}
      slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
      PaperProps={{sx: {width: 820, maxWidth: "calc(100% - 32px)", borderRadius: "28px", p: "28px", boxShadow: shadow.dialog, display: "grid", gridTemplateColumns: "400px minmax(0,1fr)", gap: "28px"}}}
    >
      {files.input}
      <Box sx={{display: "flex", flexDirection: "column", gap: "14px", minWidth: 0}}>
        <PhotoCropper
          img={c.img}
          crop={c.crop}
          onCrop={c.setCrop}
          tone="soft"
          sx={{width: 400, height: 400, borderRadius: "20px"}}
          empty={
            <Box component="span" sx={{color: color.white, fontSize: 14, fontWeight: 600, px: "24px"}}>
              {c.loading ? "Učitavam…" : "Odaberi sliku desno"}
            </Box>
          }
        />
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          <ZoomSlider value={c.crop.zoom} onChange={(z) => c.setCrop({...c.crop, zoom: z})} tone="soft" disabled={!c.img} />
          <IconCircleButton label="Okreni" size={44} disabled={!c.img} onClick={() => c.setCrop(rotatePhotoLeft(c.crop))} sx={softButton}>
            <Rotate90DegreesCcwRoundedIcon />
          </IconCircleButton>
          <IconCircleButton label="Vrati" size={44} disabled={!c.img} onClick={() => c.setCrop({...PHOTO_CROP_START})} sx={softButton}>
            <RestartAltRoundedIcon />
          </IconCircleButton>
        </Box>
        <Box sx={{fontSize: 13, color: color.muted, textAlign: "center"}}>Povuci sliku za pomak, kotačić ili klizač za zum, dvoklik vraća.</Box>
      </Box>

      <Box sx={{display: "flex", flexDirection: "column", gap: "16px", minWidth: 0}}>
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
          <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, letterSpacing: "-.01em"}}>
            {text.title}
          </Box>
          <IconCircleButton label="Zatvori" size={44} onClick={onClose} disabled={busy} sx={softButton}>
            <CloseRoundedIcon />
          </IconCircleButton>
        </Box>
        <Box
          component="button"
          type="button"
          onClick={files.open}
          onDragOver={(ev: React.DragEvent) => {
            ev.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(ev: React.DragEvent) => {
            ev.preventDefault();
            setOver(false);
            const f = ev.dataTransfer.files?.[0];
            if (f) c.pick(f);
          }}
          sx={{
            ...buttonBase,
            minHeight: 146,
            borderRadius: "18px",
            border: `2px dashed ${over ? color.navy : color.borderStrong}`,
            background: over ? color.cream2 : color.paper2,
            color: color.ink,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            p: "16px",
            transition: "background 150ms ease, border-color 150ms ease",
            "& svg": {fontSize: 28, color: color.navy},
          }}
        >
          <UploadRoundedIcon aria-hidden />
          <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
            Povuci sliku ovdje ili odaberi datoteku
          </Box>
          <Box component="span" sx={{fontSize: 13.5, color: color.muted}}>
            PNG, JPG ili WebP
          </Box>
        </Box>
        {google && <GoogleCard desktop email={google.email} onUse={() => c.take({src: `${GOOGLE_PHOTO_PATH}?t=${Date.now()}`, fresh: true})} />}
        {kind === "team" && (
          <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
            <Box id={whoId} sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted, pl: "4px"}}>
              {text.who}
            </Box>
            <VisibilityChoices kind="team" value={photo.info.photo_visibility} onChange={photo.setVisibility} labelId={whoId} />
            <Box sx={{fontSize: 13, color: color.muted, pl: "4px"}}>{text.hiddenNote}</Box>
          </Box>
        )}
        {(c.error || photo.error) && <ErrorNote>{c.error || photo.error}</ErrorNote>}
        <Box sx={{flex: 1}} />
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          {photo_url && (
            <IconCircleButton label="Makni sliku" size={52} onClick={remove} disabled={busy} sx={{boxShadow: "none", borderRadius: "16px", background: tint.red[8], color: color.red, "& svg": {fontSize: 22}}}>
              <DeleteRoundedIcon />
            </IconCircleButton>
          )}
          <Box sx={{flex: 1}} />
          <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{px: "22px", fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
            Odustani
          </OutlineButton>
          <SolidButton height={52} disabled={!c.img || !c.dirty} loading={busy} onClick={save} sx={{px: "26px", fontSize: 16}}>
            Spremi
          </SolidButton>
        </Box>
      </Box>
    </Dialog>
  );
}
