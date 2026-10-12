"use client";

import {arrivalKind, stackDepth} from "@/app/_lib/navStack";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

// What a page keeps for its place in the tab's history, so that Back (or Forward) to it shows it as it was left: where a
// list that scrolls inside the page was (the browser restores only the page's own scroll), a picked row. Kept in
// memory, as Back inside the app keeps the app loaded. A link or push to the page starts afresh.
const memory = new Map<string, unknown>();

// the page's entry in the tab's history: its path and its place in the page stack (_lib/navStack.ts)
function entryKey(name: string, path: string): string {
  return `${name}|${stackDepth(path)}|${path}`;
}

export type ScrollMemory = {
  // goes on the scrolling element, rendered only once the list's rows are there
  ref: (el: HTMLElement | null) => void;
  // the list was put back where it was left (the page then skips its own first scroll, to a highlighted row)
  restored: () => boolean;
  // the scrolling element, while it is there
  element: () => HTMLElement | null;
};

// A list that scrolls inside the page (a standings card): Back to the page puts it back where it was left.
export function useScrollMemory(name: string): ScrollMemory {
  const pathname = usePathname();
  const visit = useRef<{path: string; key: string; restored: boolean} | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const ref = useCallback(
    (el: HTMLElement | null) => {
      detach.current?.();
      detach.current = null;
      current.current = el;
      if (!el) return;
      if (visit.current?.path !== pathname) {
        // the first list of this visit
        const key = entryKey(name, pathname);
        const saved = memory.get(key);
        const back = arrivalKind(pathname) === "pop" && typeof saved === "number";
        if (back) el.scrollTop = saved;
        visit.current = {path: pathname, key, restored: back};
      }
      const key = visit.current.key;
      const save = () => memory.set(key, el.scrollTop);
      save();
      el.addEventListener("scroll", save, {passive: true});
      detach.current = () => el.removeEventListener("scroll", save);
    },
    [name, pathname]
  );
  const restored = useCallback(() => visit.current?.restored === true, []);
  const element = useCallback(() => current.current, []);
  return useMemo(() => ({ref, restored, element}), [ref, restored, element]);
}

// useState whose value comes back with Back to the page (the player picked on the desktop Rejting); any other arrival
// starts from `initial`
export function useRestoredState<T>(name: string, initial: T): [T, (value: T) => void] {
  const pathname = usePathname();
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined" || arrivalKind(pathname) !== "pop") return initial;
    const key = entryKey(name, pathname);
    return memory.has(key) ? (memory.get(key) as T) : initial;
  });
  useEffect(() => {
    memory.set(entryKey(name, pathname), value);
  }, [name, pathname, value]);
  return [value, setValue];
}
