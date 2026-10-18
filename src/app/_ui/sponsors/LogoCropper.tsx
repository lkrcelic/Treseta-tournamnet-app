"use client";

import {LogoBackground} from "@/app/_interfaces/sponsor";
import {CROP_ASPECT, CROP_START, clampCrop, CropState, placement} from "@/app/_lib/ui/logoCrop";
import {color, crop as cropColor} from "@/app/_styles/tokens";
import {Box} from "@mui/material";
import React, {useEffect, useLayoutEffect, useRef, useState} from "react";

// The cropper's stage (Claude Design "Profilna slika · dijalog" D2 and "Pomakni i zumiraj" M3, for a sponsor's logo):
// the logo on the tile it will have (the black plate, or white for no background), the frame it is cut to, and the
// shade around it. Drag to move it, two fingers, the wheel or the slider to zoom; a double tap or click goes back to
// the start. tone: "dark" is the phone's black full screen, "soft" the computer's grey square.
export function LogoCropper({
  img,
  crop,
  onCrop,
  background,
  tone,
  empty,
  sx,
}: {
  img: HTMLImageElement | null;
  crop: CropState;
  onCrop: (c: CropState) => void;
  background: LogoBackground;
  tone: "dark" | "soft";
  // shown in the frame while there is no logo yet
  empty?: React.ReactNode;
  sx?: object;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w: 0, h: 0});
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, {x: number; y: number}>());
  const pinch = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({w: el.clientWidth, h: el.clientHeight});
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the frame: as wide as the stage allows with room around it for the tile, which is 1.9 : 1 around the frame
  const margin = tone === "dark" ? 28 : 36;
  const tileOverFrame = 1.9 / (0.72 * CROP_ASPECT);
  const fw = Math.max(0, Math.min((size.w - 2 * margin) / tileOverFrame, (size.h - 2 * margin) * CROP_ASPECT * 0.72));
  const fh = fw / CROP_ASPECT;
  const left = (size.w - fw) / 2;
  const top = (size.h - fh) / 2;
  // the tile around the frame (logoTile's padding): its height is the frame's / 0.72
  const tileH = fh / 0.72;
  const tileW = tileH * 1.9;
  const iw = img?.naturalWidth ?? 1;
  const ih = img?.naturalHeight ?? 1;
  const set = (c: CropState) => onCrop(clampCrop(c, iw, ih, fw || 1, fh || 1));

  // the wheel zooms (a passive listener couldn't stop the page from scrolling)
  const latest = useRef({crop, set});
  latest.current = {crop, set};
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!img) return;
      e.preventDefault();
      const {crop: c, set: apply} = latest.current;
      apply({...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.0015)});
    };
    el.addEventListener("wheel", wheel, {passive: false});
    return () => el.removeEventListener("wheel", wheel);
  }, [img]);

  const down = (e: React.PointerEvent) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    pinch.current = null;
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !img || !fw) return;
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const pts = Array.from(pointers.current.values());
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current) set({...crop, zoom: (crop.zoom * dist) / pinch.current});
      pinch.current = dist;
      return;
    }
    set({...crop, panX: crop.panX + (e.clientX - prev.x) / fw, panY: crop.panY + (e.clientY - prev.y) / fh});
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const p = img && fw ? placement(iw, ih, fw, fh, crop) : null;
  const dark = tone === "dark";

  return (
    <Box
      ref={stageRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={() => img && set({...CROP_START})}
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
      {fw > 0 && (
        <>
          {/* the tile the logo will have: the black plate, or white (the card the band sits on) */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left: (size.w - tileW) / 2,
              top: (size.h - tileH) / 2,
              width: tileW,
              height: tileH,
              borderRadius: `${tileH * 0.26}px`,
              background: background === "dark" ? color.logoPlate : color.white,
            }}
          />
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
          {/* the frame the logo is cut to, with the shade around it and the grid while dragging */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left,
              top,
              width: fw,
              height: fh,
              boxSizing: "border-box",
              border: `1.5px solid ${cropColor.rim}`,
              borderRadius: "4px",
              boxShadow: `0 0 0 9999px ${cropColor.shade}`,
              pointerEvents: "none",
              backgroundImage: dragging
                ? `linear-gradient(${cropColor.grid}, ${cropColor.grid}), linear-gradient(${cropColor.grid}, ${cropColor.grid}), linear-gradient(${cropColor.grid}, ${cropColor.grid}), linear-gradient(${cropColor.grid}, ${cropColor.grid})`
                : "none",
              backgroundSize: "1px 100%, 1px 100%, 100% 1px, 100% 1px",
              backgroundPosition: "33.33% 0, 66.67% 0, 0 33.33%, 0 66.67%",
              backgroundRepeat: "no-repeat",
            }}
          />
          {!img && empty && (
            <Box sx={{position: "absolute", left, top, width: fw, height: fh, display: "flex", alignItems: "center", justifyContent: "center"}}>{empty}</Box>
          )}
        </>
      )}
    </Box>
  );
}
