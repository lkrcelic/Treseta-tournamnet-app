"use client";

import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useRef, useState} from "react";

// Small parts of the admin's sponsor screens (Claude Design "Sponzori ekrani")

// "Dodaj sponzora", "Odaberi sponzore": a white row with a dashed border, the icon and the label
export function DashedAction({icon, children, onClick}: {icon: React.ReactNode; children: React.ReactNode; onClick: () => void}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        ...buttonBase,
        flex: "none",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        px: "14px",
        borderRadius: "16px",
        border: `1.5px dashed ${color.borderStrong}`,
        background: color.white,
        color: color.navy,
        fontSize: 16,
        fontWeight: 600,
        textAlign: "left",
        "& svg": {fontSize: 22},
        "&:active": {background: color.paper2},
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

// "Još nema sponzora", "Liga još nema sponzora": the handshake in a cream circle, a title, a line and the action
export function SponsorEmpty({title, text, children, sx}: {title: string; text: string; children?: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box sx={[{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center"}, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <Box component="span" aria-hidden sx={{width: 56, height: 56, borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 30}}}>
        <HandshakeOutlinedIcon />
      </Box>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1.15}}>
        {title}
      </Box>
      <Box component="p" sx={{m: 0, fontSize: 14.5, lineHeight: 1.5, color: color.muted, textWrap: "pretty", maxWidth: 300}}>
        {text}
      </Box>
      {children && <Box sx={{alignSelf: "stretch", display: "flex", flexDirection: "column", gap: "10px", mt: "8px"}}>{children}</Box>}
    </Box>
  );
}

// The white card a phone list sits on
export const listCardSx = {flex: "none", background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card} as const;

// A checkbox of the picking lists (Odaberi sponzore): navy with a tick, or an empty outlined square
export function CheckBox({on}: {on: boolean}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 26,
        height: 26,
        flex: "none",
        boxSizing: "border-box",
        borderRadius: "8px",
        border: on ? "none" : `2px solid ${color.borderStrong}`,
        background: on ? color.navy : color.white,
        color: color.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": {fontSize: 20},
      }}
    >
      {on && <CheckRoundedIcon />}
    </Box>
  );
}

// A league's sponsors in an order the admin changes by dragging a row's handle (with a finger or the mouse); the
// arrow keys on a focused handle move it too. onMove gets the new order once the row is let go.
export function useDragOrder<T>(items: T[], onMove: (next: T[]) => void) {
  const [drag, setDrag] = useState<{from: number; to: number; dy: number} | null>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);
  const start = useRef<{y: number; tops: number[]; heights: number[]} | null>(null);

  const targetIndex = (from: number, dy: number) => {
    const s = start.current;
    if (!s) return from;
    // the dragged row goes after every other row whose middle it has passed
    const center = s.tops[from] + s.heights[from] / 2 + dy;
    return s.tops.filter((top, i) => i !== from && top + s.heights[i] / 2 < center).length;
  };

  const handleProps = (index: number, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `${label}: povuci za redoslijed`,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const els = rows.current.slice(0, items.length);
      start.current = {y: e.clientY, tops: els.map((el) => el?.offsetTop ?? 0), heights: els.map((el) => el?.offsetHeight ?? 0)};
      setDrag({from: index, to: index, dy: 0});
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!drag || !start.current) return;
      const dy = e.clientY - start.current.y;
      setDrag({from: drag.from, to: targetIndex(drag.from, dy), dy});
    },
    onPointerUp: () => {
      if (drag && drag.to !== drag.from) {
        const next = items.slice();
        const [it] = next.splice(drag.from, 1);
        next.splice(drag.to, 0, it);
        onMove(next);
      }
      setDrag(null);
      start.current = null;
    },
    onPointerCancel: () => {
      setDrag(null);
      start.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
      if (to == null || to < 0 || to >= items.length) return;
      e.preventDefault();
      const next = items.slice();
      const [it] = next.splice(index, 1);
      next.splice(to, 0, it);
      onMove(next);
    },
  });

  // where a row is drawn while another is dragged: the dragged one follows the pointer, the ones it passes make room
  const rowSx = (index: number): SxProps<Theme> => {
    if (!drag || !start.current) return {};
    const h = start.current.heights[drag.from] ?? 0;
    if (index === drag.from) return {transform: `translateY(${drag.dy}px)`, position: "relative", zIndex: 2, background: color.white, boxShadow: shadow.cardHover};
    const shift = drag.from < drag.to && index > drag.from && index <= drag.to ? -h : drag.from > drag.to && index < drag.from && index >= drag.to ? h : 0;
    return {transform: `translateY(${shift}px)`, transition: "transform 160ms ease"};
  };

  const rowRef = (index: number) => (el: HTMLElement | null) => {
    rows.current[index] = el;
  };

  return {handleProps, rowSx, rowRef, dragging: drag != null};
}

// The drag handle of a row
export function DragHandle(props: ReturnType<ReturnType<typeof useDragOrder>["handleProps"]>) {
  return (
    <Box
      component="span"
      {...props}
      sx={{
        width: 32,
        height: 44,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
        color: color.faint,
        cursor: "grab",
        touchAction: "none",
        "&:active": {cursor: "grabbing"},
        "& svg": {fontSize: 22},
      }}
    >
      <DragIndicatorRoundedIcon aria-hidden />
    </Box>
  );
}
