"use client";

import {useEffect, useRef} from "react";

// "Učitaj još" at the end of a list goes away with the last page, and the keyboard focus would drop to the top of the
// document: it moves to the first row that page brought instead (while there are more pages it stays on the button,
// which moves down with the list). list(): the list's element; rows: the selector of its rows inside it; shown: how
// many rows are shown. Returns the button's onClick.
export default function useMoreFocus(list: () => HTMLElement | null, rows: string, shown: number, onMore: () => void): () => void {
  const firstNew = useRef<number | null>(null);
  useEffect(() => {
    const from = firstNew.current;
    firstNew.current = null;
    const box = list();
    if (from == null || !box || box.contains(document.activeElement)) return;
    const row = box.querySelectorAll<HTMLElement>(rows)[from];
    (row?.matches("a, button") ? row : row?.querySelector<HTMLElement>("a, button"))?.focus();
  }, [shown, list, rows]);
  return () => {
    firstNew.current = shown;
    onMore();
  };
}
