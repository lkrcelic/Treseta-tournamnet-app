"use client";

import useReducedMotion from "@/app/_hooks/useReducedMotion";
import {useEffect, useRef, useState} from "react";

// Animates a number from its previous value to `target` (ease-out cubic). Jumps straight there under reduced motion
// or with a duration of 0.
// `from` sets the starting value on mount, e.g. the totals before the hand that was just saved.
export default function useCountUp(target: number, duration = 600, delay = 200, from?: number): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(from ?? target);
  const shownRef = useRef(from ?? target);

  useEffect(() => {
    if (reduce || duration <= 0 || shownRef.current === target) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const from = shownRef.current;
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      shownRef.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay, reduce]);

  return shown;
}
