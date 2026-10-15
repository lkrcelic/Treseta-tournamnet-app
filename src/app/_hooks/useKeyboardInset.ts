"use client";

import {useEffect, useState} from "react";

// Smaller differences are the browser's own toolbars coming and going, not a keyboard
const KEYBOARD_MIN = 80;

export type KeyboardInset = {
  // how much of the bottom of the layout viewport the on-screen keyboard covers (0 without one)
  inset: number;
  // the height still visible above the keyboard; null without a keyboard
  visible: number | null;
};

const NONE: KeyboardInset = {inset: 0, visible: null};

// The on-screen keyboard, from the visual viewport: iOS Safari and Chrome on Android shrink only the visual viewport
// when it opens, so a sheet fixed to the bottom would sit behind it. A sheet with a search field moves up by `inset`
// and fits into `visible` (the search stays above the keyboard). Only listens while `active` (the sheet is open).
export default function useKeyboardInset(active: boolean): KeyboardInset {
  const [state, setState] = useState<KeyboardInset>(NONE);

  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!active || !vv) {
      setState(NONE);
      return;
    }
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setState((prev) => {
        const next = inset >= KEYBOARD_MIN ? {inset, visible: Math.round(vv.height)} : NONE;
        return prev.inset === next.inset && prev.visible === next.visible ? prev : next;
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return state;
}
