"use client";

import {useCallback, useEffect, useState} from "react";

// The height of an element as it changes (window resize, content above it). Pass the returned ref callback as
// the element's ref; the height is null until the element is on screen. The first measurement happens when the
// element mounts, before the browser paints, so a layout depending on it doesn't flash.
export default function useElementHeight<T extends HTMLElement>(): [(el: T | null) => void, number | null] {
  const [el, setEl] = useState<T | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const ref = useCallback((node: T | null) => {
    setEl(node);
    if (node) setHeight(node.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return [ref, height];
}
