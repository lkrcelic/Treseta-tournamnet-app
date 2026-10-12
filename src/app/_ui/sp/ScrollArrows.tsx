"use client";

import {color, shadow, tint} from "@/app/_styles/tokens";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import {Box} from "@mui/material";
import React, {useCallback, useEffect, useRef, useState} from "react";

type Place = {x: number; upY: number; downY: number; upOn: boolean; downOn: boolean};

const ARROW = 40;

// the nearest list or panel under the mouse that can scroll (inside the desktop frame)
function scrollableAt(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  for (let el = target instanceof HTMLElement ? target : null; el && el !== root; el = el.parentElement) {
    if (el.scrollHeight - el.clientHeight > 4) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return el;
    }
  }
  return null;
}

// A link or button in the list that the pointer is on (a pill or a button, not a whole row): an arrow over it gives way,
// so "Stranica ekipe ›" at the top right of a card can still be clicked
function controlAt(target: EventTarget | null, list: HTMLElement): DOMRect | null {
  const el = target instanceof Element ? target.closest("a[href], button, input, select, textarea, [role='button']") : null;
  if (!el || el === list || !list.contains(el)) return null;
  const r = el.getBoundingClientRect();
  return r.width < list.clientWidth / 2 ? r : null;
}

const covers = (r: DOMRect | null, x: number, y: number) => r != null && r.left < x + ARROW && r.right > x && r.top < y + ARROW && r.bottom > y;

function placeOf(el: HTMLElement, hovered: EventTarget | null): Place {
  const r = el.getBoundingClientRect();
  const x = Math.round(r.right - 52);
  const upY = Math.round(r.top + 10);
  const downY = Math.round(r.bottom - 50);
  const control = controlAt(hovered, el);
  return {
    x,
    upY,
    downY,
    upOn: el.scrollTop > 1 && !covers(control, x, upY),
    downOn: el.scrollTop + el.clientHeight < el.scrollHeight - 1 && !covers(control, x, downY),
  };
}

const same = (a: Place | null, b: Place | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.upY === b.upY && a.downY === b.downY && a.upOn === b.upOn && a.downOn === b.downOn);

// Desktop: hovering any list that scrolls shows round up/down arrows at its right edge (only the directions it can
// still go). A click scrolls 60% of the list; holding the button keeps scrolling until it is released. Handy on a
// projector laptop without a scroll wheel. Mouse only; touch screens scroll as usual. An arrow steps aside while the
// pointer is on a link or button it would cover.
export function useScrollArrows(rootRef: React.RefObject<HTMLElement>) {
  const [place, setPlace] = useState<Place | null>(null);
  const target = useRef<HTMLElement | null>(null);
  // what the pointer was last on (an arrow gives way to a link under it)
  const hovered = useRef<EventTarget | null>(null);
  const hold = useRef<{timer?: number; interval?: number}>({});
  const canHover = useRef(false);

  useEffect(() => {
    canHover.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const update = useCallback((el: HTMLElement | null) => {
    target.current = el;
    const next = el ? placeOf(el, hovered.current) : null;
    setPlace((prev) => (same(prev, next) ? prev : next));
  }, []);

  const stop = useCallback(() => {
    window.clearTimeout(hold.current.timer);
    window.clearInterval(hold.current.interval);
  }, []);

  // the arrows follow the list while it scrolls (wheel, keyboard or the arrows themselves)
  useEffect(() => {
    const onScroll = (e: Event) => {
      if (e.target === target.current) update(target.current);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      stop();
    };
  }, [update, stop]);

  const onMouseMove = (e: React.MouseEvent) => {
    const root = rootRef.current;
    if (!canHover.current || !root) return;
    if ((e.target as HTMLElement).closest?.("[data-scroll-arrow]")) return;
    hovered.current = e.target;
    update(scrollableAt(e.target, root));
  };
  const onMouseLeave = () => {
    stop();
    hovered.current = null;
    update(null);
  };

  const start = (dir: 1 | -1) => {
    const el = target.current;
    if (!el) return;
    stop();
    el.scrollBy({top: dir * el.clientHeight * 0.6, behavior: "smooth"});
    hold.current.timer = window.setTimeout(() => {
      hold.current.interval = window.setInterval(() => {
        el.scrollTop += dir * 14;
      }, 16);
    }, 380);
  };

  const arrow = (dir: 1 | -1, top: number) => (
    <Box
      component="button"
      type="button"
      data-scroll-arrow
      tabIndex={-1}
      aria-label={dir < 0 ? "Pomakni gore" : "Pomakni dolje"}
      onMouseDown={(e: React.MouseEvent) => {
        if (e.button === 0) start(dir);
      }}
      onMouseUp={stop}
      onMouseLeave={stop}
      sx={{
        position: "fixed",
        // above the nav drawer (1200) and dialogs (1300), whose lists get arrows too
        zIndex: 1350,
        left: place!.x,
        top,
        width: ARROW,
        height: ARROW,
        p: 0,
        border: "none",
        borderRadius: "50%",
        background: tint.navy[92],
        color: color.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: shadow.arrow,
        transition: "transform 120ms ease, background 120ms ease",
        "&:hover": {background: color.navy, transform: "scale(1.06)"},
        "& svg": {fontSize: 26},
      }}
    >
      {dir < 0 ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
    </Box>
  );

  const arrows = place && (
    <>
      {place.upOn && arrow(-1, place.upY)}
      {place.downOn && arrow(1, place.downY)}
    </>
  );

  return {onMouseMove, onMouseLeave, arrows};
}
