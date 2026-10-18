"use client";

import {
  clampPhotoCrop,
  cropToSquare,
  dragPhotoCrop,
  loadPhoto,
  loadPhotoFile,
  PHOTO_CROP_START,
  PhotoCrop,
  photoPlacement,
  rotatePhotoLeft,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/app/_lib/ui/photoCrop";
import {color, crop as cropColor} from "@/app/_styles/tokens";
import {buttonBase, ErrorNote} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import Rotate90DegreesCcwRoundedIcon from "@mui/icons-material/Rotate90DegreesCcwRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import {Box, Dialog} from "@mui/material";
import React, {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {useFilePicker} from "./PhotoParts";

// Cropping a profile photo to its circle (Claude Design "Pomakni i zumiraj" M3 and the dialog D2): the photo, the circle
// it is cut to with the shade around it, and the 3×3 grid while it is dragged. Drag to move it, two fingers, the wheel
// or the slider to zoom (1–3×); a double tap or click goes back to the start. The photo always covers the circle
// (photoCrop.ts).

// a picked file; or an address of this app: the saved photo to crop again (fresh false) or the Google picture (fresh)
export type CropSource = {file: File} | {src: string; fresh: boolean};

// The photo being cropped and how: loads the picked file (or an address of this app), starts every new photo from
// the middle; dirty once anything changed, so Spremi has something to save
export function usePhotoCrop(source: CropSource | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCropState] = useState<PhotoCrop>(PHOTO_CROP_START);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const take = useCallback(async (next: CropSource) => {
    setError(null);
    setLoading(true);
    try {
      const loaded = "file" in next ? await loadPhotoFile(next.file) : await loadPhoto(next.src);
      setImg(loaded);
      setCropState(PHOTO_CROP_START);
      setDirty("file" in next || next.fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Slika se nije učitala.");
    } finally {
      setLoading(false);
    }
  }, []);

  const key = source ? ("file" in source ? source.file : source.src) : null;
  useEffect(() => {
    if (source) take(source);
    else {
      setImg(null);
      setDirty(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCrop = useCallback((c: PhotoCrop) => {
    setCropState(clampPhotoCrop(c));
    setDirty(true);
  }, []);

  // the crop as it is sent (a data: URL), or null with the reason in error
  const render = useCallback((): string | null => {
    if (!img) return null;
    try {
      return cropToSquare(img, crop);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Slika se nije spremila.");
      return null;
    }
  }, [img, crop]);

  return {img, crop, setCrop, error, setError, dirty, loading, pick: (file: File) => take({file}), take, render};
}

export type PhotoCropState = ReturnType<typeof usePhotoCrop>;

// tone: "dark" is the phone's black full screen (a 300 px circle), "soft" the computer's grey square (the circle fills
// most of it). empty: what the circle shows while there is no photo yet.
export function PhotoCropper({img, crop, onCrop, tone, empty, sx}: {img: HTMLImageElement | null; crop: PhotoCrop; onCrop: (c: PhotoCrop) => void; tone: "dark" | "soft"; empty?: React.ReactNode; sx?: object}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w: 0, h: 0});
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, {x: number; y: number}>());
  const pinch = useRef<number | null>(null);
  // the last tap of a finger, for a double tap (a touch screen gives no dblclick here)
  const lastTap = useRef<{t: number; x: number; y: number} | null>(null);
  const downAt = useRef<{x: number; y: number} | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({w: el.clientWidth, h: el.clientHeight});
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dark = tone === "dark";
  const circle = Math.max(0, dark ? Math.min(300, size.w - 32, size.h - 32) : Math.min(size.w, size.h) * 0.82);
  const left = (size.w - circle) / 2;
  const top = (size.h - circle) / 2;
  const iw = img?.naturalWidth ?? 1;
  const ih = img?.naturalHeight ?? 1;

  // the wheel zooms (a passive listener couldn't stop the page from scrolling)
  const latest = useRef({crop, onCrop});
  latest.current = {crop, onCrop};
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!img) return;
      e.preventDefault();
      const {crop: c, onCrop: apply} = latest.current;
      apply({...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.0015)});
    };
    el.addEventListener("wheel", wheel, {passive: false});
    return () => el.removeEventListener("wheel", wheel);
  }, [img]);

  const down = (e: React.PointerEvent) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    downAt.current = {x: e.clientX, y: e.clientY};
    pinch.current = null;
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !img || !circle) return;
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const pts = Array.from(pointers.current.values());
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current) onCrop({...crop, zoom: (crop.zoom * dist) / pinch.current});
      pinch.current = dist;
      return;
    }
    onCrop(dragPhotoCrop(crop, e.clientX - prev.x, e.clientY - prev.y, iw, ih, circle));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
    // a double tap with a finger goes back to the start (the mouse has onDoubleClick)
    const start = downAt.current;
    if (e.pointerType !== "mouse" && img && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) {
      const now = Date.now();
      const last = lastTap.current;
      if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
        onCrop({...PHOTO_CROP_START});
        lastTap.current = null;
      } else lastTap.current = {t: now, x: e.clientX, y: e.clientY};
    }
  };

  const p = img && circle ? photoPlacement(iw, ih, circle, crop) : null;
  const grid = `linear-gradient(${cropColor.grid}, ${cropColor.grid})`;

  return (
    <Box
      ref={stageRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => img && onCrop({...PHOTO_CROP_START})}
      aria-hidden
      sx={{
        position: "relative",
        overflow: "hidden",
        background: dark ? cropColor.stage : cropColor.stageSoft,
        touchAction: "none",
        userSelect: "none",
        cursor: img ? (dragging ? "grabbing" : "grab") : "default",
        ...sx,
      }}
    >
      {circle > 0 && (
        <>
          {p && img && (
            <Box
              component="img"
              src={img.src}
              alt=""
              draggable={false}
              sx={{
                position: "absolute",
                left: left + p.cx - p.w / 2,
                top: top + p.cy - p.h / 2,
                width: p.w,
                height: p.h,
                maxWidth: "none",
                transform: `rotate(${p.rotate}deg)`,
                pointerEvents: "none",
              }}
            />
          )}
          {/* the circle the photo is cut to: the shade around it, its white rim, the grid while dragging */}
          <Box
            sx={{
              position: "absolute",
              left,
              top,
              width: circle,
              height: circle,
              boxSizing: "border-box",
              borderRadius: "50%",
              border: `1.5px solid ${cropColor.rim}`,
              boxShadow: `0 0 0 9999px ${cropColor.shade}`,
              pointerEvents: "none",
              backgroundImage: dragging ? `${grid}, ${grid}, ${grid}, ${grid}` : "none",
              backgroundSize: "1px 100%, 1px 100%, 100% 1px, 100% 1px",
              backgroundPosition: "33.33% 0, 66.67% 0, 0 33.33%, 0 66.67%",
              backgroundRepeat: "no-repeat",
            }}
          />
          {!img && empty && (
            <Box sx={{position: "absolute", left, top, width: circle, height: circle, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center"}}>{empty}</Box>
          )}
        </>
      )}
    </Box>
  );
}

// − slider + : the zoom, 1–3×. Cream on the phone's black, navy on the computer.
export function ZoomSlider({value, onChange, tone, disabled}: {value: number; onChange: (z: number) => void; tone: "dark" | "soft"; disabled?: boolean}) {
  const dark = tone === "dark";
  return (
    <Box sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", color: dark ? color.white : color.navy, "& svg": {fontSize: 22, flex: "none"}}}>
      {dark ? <RemoveRoundedIcon aria-hidden /> : <ZoomOutRoundedIcon aria-hidden />}
      <Box
        component="input"
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={0.01}
        value={value}
        disabled={disabled}
        aria-label="Zum"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        sx={{flex: 1, minWidth: 0, accentColor: dark ? color.cream : color.navy, cursor: "pointer", "&:disabled": {opacity: 0.4}}}
      />
      {dark ? <AddRoundedIcon aria-hidden /> : <ZoomInRoundedIcon aria-hidden />}
    </Box>
  );
}

// "Pomakni i zumiraj" on the phone (M3): the black full screen with Odustani, the title and Spremi on top, the photo in
// its 300 px circle, and under it the zoom, Okreni, Vrati and Druga slika. onSave gets the crop and answers whether it
// was saved (the screen then closes).
export function PhotoScreen({source, onClose, onSave}: {source: CropSource; onClose: () => void; onSave: (data: string) => Promise<boolean>}) {
  const c = usePhotoCrop(source);
  const other = useFilePicker(c.pick);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const data = c.render();
    if (!data || saving) return;
    setSaving(true);
    const ok = await onSave(data);
    setSaving(false);
    if (ok) onClose();
  };
  const pill = {
    ...buttonBase,
    height: 44,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    px: "16px",
    borderRadius: "22px",
    background: cropColor.pill,
    color: color.white,
    fontSize: 15,
    fontWeight: 600,
    "& svg": {fontSize: 20},
    "&:disabled": {opacity: 0.4},
  };
  return (
    <Dialog open fullScreen onClose={saving ? undefined : onClose} aria-labelledby={titleId} PaperProps={{sx: {background: cropColor.stage, color: color.white, display: "flex", flexDirection: "column"}}}>
      {other.input}
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", p: "calc(10px + env(safe-area-inset-top)) 8px 10px"}}>
        <Box component="button" type="button" onClick={onClose} disabled={saving} sx={{...buttonBase, justifySelf: "start", height: 44, px: "12px", color: color.white, fontSize: 16, fontWeight: 500}}>
          Odustani
        </Box>
        <Box component="h2" id={titleId} sx={{m: 0, fontSize: 16, fontWeight: 700}}>
          Pomakni i zumiraj
        </Box>
        <Box
          component="button"
          type="button"
          disabled={!c.img || saving}
          aria-busy={saving || undefined}
          onClick={save}
          sx={{...buttonBase, justifySelf: "end", height: 44, px: "12px", color: color.cream, fontSize: 16, fontWeight: 700, "&:disabled": {opacity: 0.4}}}
        >
          {saving ? "Spremam…" : "Spremi"}
        </Box>
      </Box>
      <PhotoCropper img={c.img} crop={c.crop} onCrop={c.setCrop} tone="dark" sx={{flex: 1, minHeight: 0}} />
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "16px", p: "16px 20px calc(18px + env(safe-area-inset-bottom))"}}>
        {c.error && <ErrorNote>{c.error}</ErrorNote>}
        <ZoomSlider value={c.crop.zoom} onChange={(z) => c.setCrop({...c.crop, zoom: z})} tone="dark" disabled={!c.img} />
        <Box sx={{display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap"}}>
          <Box component="button" type="button" disabled={!c.img} onClick={() => c.setCrop(rotatePhotoLeft(c.crop))} sx={pill}>
            <Rotate90DegreesCcwRoundedIcon aria-hidden />
            Okreni
          </Box>
          <Box component="button" type="button" disabled={!c.img} onClick={() => c.setCrop({...PHOTO_CROP_START})} sx={pill}>
            <RestartAltRoundedIcon aria-hidden />
            Vrati
          </Box>
          <Box component="button" type="button" onClick={other.open} sx={pill}>
            <SwapHorizRoundedIcon aria-hidden />
            Druga slika
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
