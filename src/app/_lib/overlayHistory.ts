// The phone's Back closes the open sheet or full-screen dialog (BottomSheet, the photo viewer, Pomakni i zumiraj)
// instead of leaving the page and losing what was typed in it.
//
// Opening one adds a history entry with the same address (marked {belaSheet: key, belaDepth: n}); Back pops it, and
// the popstate closes the overlays above the entry it lands on. A busy overlay (saving) stays and gets its entry back.
// Stacked overlays (the crop over Novi sponzor) each have their own entry, so Back closes only the top one.
//
// An overlay closed any other way (✕, the scrim, Esc, after saving, or a page change) leaves its entry: going back
// from here could cancel a navigation the app starts at the same moment (Next.js drops a pending push on popstate).
// The entry is "spent" instead: opening an overlay again on it reuses it, and when Back lands below a spent entry
// (the entry under it is marked {belaBelow: key}) it goes back once more, so that Back still leaves the page.
// The logic takes the history as a parameter (tested in __tests__/overlayHistory.test.ts).

export type HistoryLike = {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  back(): void;
};

export type OverlayHandle = {key: string; depth: number};

type Overlay = OverlayHandle & {onBack: () => void; busy: () => boolean};

type Marks = {belaSheet?: unknown; belaDepth?: unknown; belaBelow?: unknown};

function marks(state: unknown): Marks {
  return state != null && typeof state === "object" ? (state as Marks) : {};
}

export function createOverlayHistory(env: {history: () => HistoryLike; afterPop?: (closed: boolean) => void}) {
  const open: Overlay[] = [];
  const spent = new Set<string>();
  let seq = 0;
  const newKey = () => `${Date.now().toString(36)}.${++seq}`;

  // the entry under the overlay knows whose entry is above it; the overlay's entry carries its depth
  function pushEntry(o: OverlayHandle) {
    const h = env.history();
    h.replaceState({...marks(h.state), belaBelow: o.key}, "");
    h.pushState({belaSheet: o.key, belaDepth: o.depth}, "");
  }

  // An overlay came on screen; onBack closes it (the caller's onClose), busy says it can't be closed now
  function opened(onBack: () => void, busy: () => boolean): OverlayHandle {
    const depth = open.length + 1;
    const here = marks(env.history().state);
    const reuse = typeof here.belaSheet === "string" && spent.has(here.belaSheet) && here.belaDepth === depth;
    const key = reuse ? (here.belaSheet as string) : newKey();
    spent.delete(key);
    const o: Overlay = {key, depth, onBack, busy};
    open.push(o);
    if (!reuse) pushEntry(o);
    return {key, depth};
  }

  // An overlay went away without Back (or was already closed by it): its entry, if still there, is spent
  function closed(handle: OverlayHandle) {
    const i = open.findIndex((o) => o.key === handle.key);
    if (i < 0) return;
    open.splice(i, 1);
    spent.add(handle.key);
  }

  // Back (or Forward) landed on an entry: close what is above it, or go on back past a spent overlay's entry
  function popped() {
    const here = marks(env.history().state);
    const depth = typeof here.belaDepth === "number" ? here.belaDepth : 0;
    const above = open.filter((o) => o.depth > depth);
    if (above.length > 0) {
      if (above.some((o) => o.busy())) {
        // saving: the overlays stay, with their entries back on top
        above.forEach(pushEntry);
      } else {
        for (const o of above) open.splice(open.indexOf(o), 1);
        above.reverse().forEach((o) => o.onBack());
      }
      env.afterPop?.(true);
      return;
    }
    env.afterPop?.(false);
    if (typeof here.belaBelow === "string" && spent.delete(here.belaBelow)) env.history().back();
  }

  // A page loaded on an overlay's entry (a reload with a sheet open) has no overlay: the entry is spent
  function loaded() {
    const here = marks(env.history().state);
    if (typeof here.belaSheet === "string") spent.add(here.belaSheet);
  }

  return {opened, closed, popped, loaded, openCount: () => open.length};
}

// ---------- the browser's ----------

let shared: ReturnType<typeof createOverlayHistory> | null = null;

export function overlayHistory(afterPop?: (closed: boolean) => void) {
  if (!shared) {
    shared = createOverlayHistory({history: () => window.history, afterPop});
    shared.loaded();
    window.addEventListener("popstate", () => shared!.popped());
  }
  return shared;
}
