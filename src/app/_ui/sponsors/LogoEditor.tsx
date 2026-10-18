"use client";

import type {LogoUpload} from "@/app/_fetchers/sponsors";
import {LogoBackground} from "@/app/_interfaces/sponsor";
import {CROP_START, CropState, LOGO_SHAPES, LogoShape, rotateLeft, shapeFor, shapeOf, ZOOM_MAX} from "@/app/_lib/ui/logoCrop";
import {loadLogoFile, loadLogoUrl, renderLogo, trimLogo} from "@/app/_lib/ui/logoUpload";
import {color, crop as cropColor, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, ErrorNote, IconCircleButton, OutlineButton, Segmented, SolidButton} from "@/app/_ui/sp";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CropRoundedIcon from "@mui/icons-material/CropRounded";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import Rotate90DegreesCcwRoundedIcon from "@mui/icons-material/Rotate90DegreesCcwRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import {Box, Dialog} from "@mui/material";
import React, {useEffect, useId, useRef, useState} from "react";
import {LogoCropper} from "./LogoCropper";

export type LogoResult = {upload: LogoUpload & {preview: string}; background: LogoBackground};

const ACCEPT = "image/png,image/jpeg,image/webp";
const BACKGROUNDS = [
  {key: "none" as LogoBackground, label: "Bez pozadine"},
  {key: "dark" as LogoBackground, label: "Crna pozadina"},
];
const SHAPES = LOGO_SHAPES.map((s) => ({key: s.key, label: s.label}));

// What the dialog and the full screen share: the logo being cropped, how, in which shape and on which background. A
// logo comes in without its empty edges, and the shape nearest to its own is chosen for it.
function useLogoEditor(initial: {src: string | null; file: File | null; background: LogoBackground}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropState>(CROP_START);
  const [shape, setShapeState] = useState<LogoShape>("wide");
  const [background, setBackground] = useState(initial.background);
  const [error, setError] = useState<string | null>(null);

  const take = async (load: Promise<HTMLImageElement>) => {
    setError(null);
    try {
      const t = await trimLogo(await load);
      setImg(t.img);
      setShapeState(shapeFor(t.img.naturalWidth / t.img.naturalHeight));
      setCrop(CROP_START);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo se nije učitao.");
    }
  };
  // the file just picked, else the saved logo to crop again
  useEffect(() => {
    if (initial.file) take(loadLogoFile(initial.file));
    else if (initial.src) take(loadLogoUrl(initial.src));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (): LogoResult | null => {
    if (!img) return null;
    try {
      return {upload: renderLogo(img, crop, shape), background};
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo se nije spremio.");
      return null;
    }
  };

  // another shape starts the crop again: the old pan and zoom were for the old frame
  const setShape = (s: LogoShape) => {
    setShapeState(s);
    setCrop(CROP_START);
  };

  return {img, crop, setCrop, shape, aspect: shapeOf(shape).aspect, setShape, background, setBackground, error, pick: (f: File) => take(loadLogoFile(f)), done};
}

// A hidden file input and the call that opens it
function useFilePicker(onFile: (f: File) => void, capture?: "environment") {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <Box
      component="input"
      ref={ref}
      type="file"
      accept={capture ? "image/jpeg" : ACCEPT}
      {...(capture ? {capture} : {})}
      tabIndex={-1}
      aria-hidden
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }}
      sx={{display: "none"}}
    />
  );
  return {input, open: () => ref.current?.click()};
}

// − slider + : the zoom, from the whole logo to ZOOM_MAX times
function ZoomSlider({value, onChange, tone}: {value: number; onChange: (z: number) => void; tone: "dark" | "soft"}) {
  const dark = tone === "dark";
  return (
    <Box sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "10px", color: dark ? color.white : color.navy, "& svg": {fontSize: 22, flex: "none"}}}>
      <ZoomOutRoundedIcon aria-hidden />
      <Box
        component="input"
        type="range"
        min={1}
        max={ZOOM_MAX}
        step={0.01}
        value={value}
        aria-label="Zum"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        sx={{flex: 1, minWidth: 0, accentColor: dark ? color.cream : color.navy, cursor: "pointer"}}
      />
      <ZoomInRoundedIcon aria-hidden />
    </Box>
  );
}

// ---------- the computer: "Logo sponzora" (D2's dialog, for a logo) ----------

export function LogoDialog({src, background, onClose, onDone}: {src: string | null; background: LogoBackground; onClose: () => void; onDone: (r: LogoResult) => void}) {
  const e = useLogoEditor({src, file: null, background});
  const titleId = useId();
  const files = useFilePicker(e.pick);
  const [over, setOver] = useState(false);

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titleId}
      maxWidth={false}
      slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
      PaperProps={{sx: {width: 820, maxWidth: "calc(100% - 32px)", borderRadius: "28px", p: "28px", boxShadow: shadow.dialog, display: "grid", gridTemplateColumns: "400px minmax(0,1fr)", gap: "28px"}}}
    >
      {files.input}
      <Box sx={{display: "flex", flexDirection: "column", gap: "14px", minWidth: 0}}>
        <LogoCropper
          img={e.img}
          crop={e.crop}
          onCrop={e.setCrop}
          aspect={e.aspect}
          background={e.background}
          tone="soft"
          sx={{width: 400, height: 400, borderRadius: "20px"}}
          empty={<Box sx={{color: color.white, fontSize: 14, fontWeight: 600, textAlign: "center", px: "12px"}}>Odaberi logo desno</Box>}
        />
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          <ZoomSlider value={e.crop.zoom} onChange={(z) => e.setCrop({...e.crop, zoom: z})} tone="soft" />
          <IconCircleButton label="Okreni" size={44} disabled={!e.img} onClick={() => e.setCrop(rotateLeft(e.crop))} sx={{boxShadow: "none", background: color.paper, "& svg": {fontSize: 22}}}>
            <Rotate90DegreesCcwRoundedIcon />
          </IconCircleButton>
          <IconCircleButton label="Vrati" size={44} disabled={!e.img} onClick={() => e.setCrop({...CROP_START})} sx={{boxShadow: "none", background: color.paper, "& svg": {fontSize: 22}}}>
            <RestartAltRoundedIcon />
          </IconCircleButton>
        </Box>
        <Box sx={{fontSize: 13, color: color.muted, textAlign: "center"}}>Povuci logo za pomak, kotačić ili klizač za zum, dvoklik vraća.</Box>
      </Box>

      <Box sx={{display: "flex", flexDirection: "column", gap: "16px", minWidth: 0}}>
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
          <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, letterSpacing: "-.01em"}}>
            Logo sponzora
          </Box>
          <IconCircleButton label="Zatvori" size={44} onClick={onClose} sx={{boxShadow: "none", background: color.paper, "& svg": {fontSize: 22}}}>
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
            if (f) e.pick(f);
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
            Povuci logo ovdje ili odaberi datoteku
          </Box>
          <Box component="span" sx={{fontSize: 13.5, color: color.muted}}>
            PNG, JPG ili WebP
          </Box>
        </Box>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
          <Box sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>Oblik loga</Box>
          <Segmented<LogoShape> items={SHAPES} value={e.shape} onChange={e.setShape} label="Oblik loga" variant="track" size={42} asTabs={false} />
          <Box sx={{fontSize: 13, color: color.muted, pl: "4px"}}>Kvadrat za okrugli ili uspravni logo, da u traci nema praznine pokraj njega.</Box>
        </Box>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
          <Box sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>Pozadina loga</Box>
          <Segmented<LogoBackground> items={BACKGROUNDS} value={e.background} onChange={e.setBackground} label="Pozadina loga" variant="track" size={42} asTabs={false} />
          <Box sx={{fontSize: 13, color: color.muted, pl: "4px"}}>Crna pozadina za svijetli logo koji se na bijelom ne vidi.</Box>
        </Box>
        {e.error && <ErrorNote>{e.error}</ErrorNote>}
        <Box sx={{flex: 1}} />
        <Box sx={{display: "flex", gap: "10px", justifyContent: "flex-end"}}>
          <OutlineButton height={52} onClick={onClose} sx={{px: "22px", fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
            Odustani
          </OutlineButton>
          <SolidButton
            height={52}
            disabled={!e.img}
            onClick={() => {
              const r = e.done();
              if (r) onDone(r);
            }}
            sx={{px: "26px", fontSize: 16}}
          >
            Gotovo
          </SolidButton>
        </Box>
      </Box>
    </Dialog>
  );
}

// ---------- the phone: where the logo comes from (M2's actions), then the full screen (M3) ----------

// "Logo sponzora": Fotografiraj, Odaberi iz galerije and, with a logo, Pomakni i zumiraj (crop it again)
export function LogoSourceSheet({hasLogo, onClose, onFile, onRecrop}: {hasLogo: boolean; onClose: () => void; onFile: (f: File) => void; onRecrop: () => void}) {
  const camera = useFilePicker(onFile, "environment");
  const gallery = useFilePicker(onFile);
  const rows: {icon: React.ReactNode; label: string; sub?: string; onClick: () => void}[] = [
    {icon: <PhotoCameraOutlinedIcon />, label: "Fotografiraj", onClick: camera.open},
    {icon: <PhotoLibraryOutlinedIcon />, label: "Odaberi iz galerije", sub: "PNG, JPG ili WebP", onClick: gallery.open},
    ...(hasLogo ? [{icon: <CropRoundedIcon />, label: "Pomakni i zumiraj", sub: "Ovaj logo", onClick: onRecrop}] : []),
  ];
  return (
    <BottomSheet open onClose={onClose} title="Logo sponzora" closable>
      {camera.input}
      {gallery.input}
      <Box component="ul" sx={{flex: "none", listStyle: "none", m: 0, p: 0, borderRadius: "18px", background: color.paper2, overflow: "hidden"}}>
        {rows.map((r, i) => (
          <Box component="li" key={r.label} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
            <Box
              component="button"
              type="button"
              onClick={r.onClick}
              sx={{...buttonBase, width: "100%", minHeight: 62, display: "flex", alignItems: "center", gap: "14px", p: "8px 14px", textAlign: "left", color: color.ink}}
            >
              <Box component="span" aria-hidden sx={{width: 40, height: 40, flex: "none", borderRadius: "12px", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
                {r.icon}
              </Box>
              <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "1px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 600}}>
                  {r.label}
                </Box>
                {r.sub && (
                  <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
                    {r.sub}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </BottomSheet>
  );
}

// Two to three choices side by side on the black full screen (Oblik loga, Pozadina loga)
function DarkChoice<T extends string>({label, items, value, onChange}: {label: string; items: {key: T; label: string}[]; value: T; onChange: (v: T) => void}) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))`, gap: "4px", p: "4px", borderRadius: "14px", background: cropColor.pill}}>
      {items.map((b) => {
        const on = value === b.key;
        return (
          <Box
            key={b.key}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(b.key)}
            sx={{...buttonBase, height: 40, borderRadius: "10px", background: on ? color.white : "transparent", color: on ? color.ink : color.white, fontSize: 14.5, fontWeight: on ? 700 : 600}}
          >
            {b.label}
          </Box>
        );
      })}
    </Box>
  );
}

// "Pomakni i zumiraj" on the phone: the black full screen with Odustani and Gotovo on top, the zoom, Okreni, Vrati and
// Druga slika under the logo, then the logo's shape and background
export function LogoScreen({file, src, background, onClose, onDone}: {file: File | null; src: string | null; background: LogoBackground; onClose: () => void; onDone: (r: LogoResult) => void}) {
  const e = useLogoEditor({src, file, background});
  const other = useFilePicker(e.pick);
  const titleId = useId();
  const pill = {
    ...buttonBase,
    height: 44,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    px: "14px",
    borderRadius: "22px",
    background: cropColor.pill,
    color: color.white,
    fontSize: 14.5,
    fontWeight: 600,
    "& svg": {fontSize: 20},
    "&:disabled": {opacity: 0.4},
  };
  return (
    <Dialog open fullScreen onClose={onClose} aria-labelledby={titleId} PaperProps={{sx: {background: cropColor.stage, color: color.white, display: "flex", flexDirection: "column"}}}>
      {other.input}
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", p: "calc(10px + env(safe-area-inset-top)) 8px 10px"}}>
        <Box component="button" type="button" onClick={onClose} sx={{...buttonBase, justifySelf: "start", height: 44, px: "12px", color: color.white, fontSize: 16, fontWeight: 500}}>
          Odustani
        </Box>
        <Box component="h2" id={titleId} sx={{m: 0, fontSize: 16, fontWeight: 700}}>
          Pomakni i zumiraj
        </Box>
        <Box
          component="button"
          type="button"
          disabled={!e.img}
          onClick={() => {
            const r = e.done();
            if (r) onDone(r);
          }}
          sx={{...buttonBase, justifySelf: "end", height: 44, px: "12px", color: color.cream, fontSize: 16, fontWeight: 700, "&:disabled": {opacity: 0.4}}}
        >
          Gotovo
        </Box>
      </Box>
      <LogoCropper img={e.img} crop={e.crop} onCrop={e.setCrop} aspect={e.aspect} background={e.background} tone="dark" sx={{flex: 1, minHeight: 0}} />
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "14px", p: "16px 20px calc(18px + env(safe-area-inset-bottom))"}}>
        {e.error && <ErrorNote>{e.error}</ErrorNote>}
        <ZoomSlider value={e.crop.zoom} onChange={(z) => e.setCrop({...e.crop, zoom: z})} tone="dark" />
        <Box sx={{display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap"}}>
          <Box component="button" type="button" disabled={!e.img} onClick={() => e.setCrop(rotateLeft(e.crop))} sx={pill}>
            <Rotate90DegreesCcwRoundedIcon aria-hidden />
            Okreni
          </Box>
          <Box component="button" type="button" disabled={!e.img} onClick={() => e.setCrop({...CROP_START})} sx={pill}>
            <RestartAltRoundedIcon aria-hidden />
            Vrati
          </Box>
          <Box component="button" type="button" onClick={other.open} sx={pill}>
            <SwapHorizRoundedIcon aria-hidden />
            Druga slika
          </Box>
        </Box>
        <DarkChoice<LogoShape> label="Oblik loga" items={SHAPES} value={e.shape} onChange={e.setShape} />
        <DarkChoice<LogoBackground> label="Pozadina loga" items={BACKGROUNDS} value={e.background} onChange={e.setBackground} />
      </Box>
    </Dialog>
  );
}
