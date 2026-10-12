// The page stack of the Team, Player, Rejting and league pages (handoff §6 "Pages stack: Back returns to the previous
// page, and the mobile top bar also has Home").
//
// The stack follows the tab's in-app history: one entry per page, with the name a stacked page gives itself
// ("Puleni", "Ivan Perić") for the desktop back pill. <RouteTransitions /> records every navigation; a page reads the
// entry below its own to know whether it has a Back and what it is called. Back itself is router.back(), so the
// stack must stay in step with the browser's history:
//   - a link or push adds an entry, even to the page below ("Puleni" → "Ivan Perić" → his team "Puleni" again is
//     three pages, and Back from the last one returns to Ivan Perić, as the browser would);
//   - a replace swaps the top entry;
//   - Back and Forward (popstate) go through enter(): a page lower in the stack is a step back (or several at once,
//     from the browser's history menu), anything else a step forward.
// Home and the nav drawer start afresh: the page they open is a root, which has no Back of its own. The entries before
// a root stay, so the browser's (or Android's) Back past Home still finds them with their Back.
// A document load from outside (a shared link, a new tab) starts a new stack: what came before isn't known.
// The reducers are pure (tested in __tests__/navStack.test.ts); the store below keeps the stack in sessionStorage, so
// a reload keeps it and another tab has its own.

export type NavEntry = {path: string; label: string | null; root?: true};
export type NavStack = readonly NavEntry[];
// how the browser got to the new page: a link or push, a replace, or Back/Forward
export type NavKind = "push" | "replace" | "pop";

// What a stacked page (Team, Player, a rating, a league from a team) gets from useNavStack for its Back and Home
export type NavStackControls = {
  // there is an in-app page to go back to (the page wasn't opened from Home, the nav drawer or a link from outside)
  canGoBack: boolean;
  // that page's name ("Puleni", "Ivan Perić"), when it gave one; the back pill falls back to "Natrag"
  previousLabel: string | null;
  // to that page (router.back()), or to the fallback page when there is none
  back: () => void;
  // to Početna
  home: () => void;
};

// a long browsing session only needs its last pages
export const NAV_STACK_MAX = 50;

const EMPTY: NavStack = [];

function top(stack: NavStack): NavEntry | null {
  return stack.length ? stack[stack.length - 1] : null;
}

function entry(path: string, label: string | null, root = false): NavEntry {
  return root ? {path, label, root: true} : {path, label};
}

// the top entry again (a reload, a second link to the page shown): only a newly known name changes
function sameTop(stack: NavStack, label: string | null): NavStack {
  const t = top(stack)!;
  return label == null || label === t.label ? stack : [...stack.slice(0, -1), {...t, label}];
}

function capped(stack: NavEntry[]): NavStack {
  return stack.length > NAV_STACK_MAX ? stack.slice(stack.length - NAV_STACK_MAX) : stack;
}

// Back or Forward to `path`: the top itself is a reload (nothing changes); a page lower in the stack is a step back, to
// its nearest entry (pops everything above it: one step for Back, several for the browser's history menu or
// history.go(-n)); anything else is a step forward (pushes). Forward to a page that is also lower in the stack (a link
// back to it) can't be told from Back by the path alone and counts as Back, the far more common of the two.
export function enter(stack: NavStack, path: string, label: string | null = null): NavStack {
  if (top(stack)?.path === path) return sameTop(stack, label);
  for (let i = stack.length - 2; i >= 0; i--) {
    if (stack[i].path === path) return sameTop(stack.slice(0, i + 1), label);
  }
  return capped([...stack, entry(path, label)]);
}

// a link or push to `path` (the page shown already is only renamed)
export function push(stack: NavStack, path: string, label: string | null = null): NavStack {
  if (top(stack)?.path === path) return sameTop(stack, label);
  return capped([...stack, entry(path, label)]);
}

// a replace: the new page takes the top's place (a root stays a root)
export function replaceTop(stack: NavStack, path: string, label: string | null = null): NavStack {
  const t = top(stack);
  if (t?.path === path) return sameTop(stack, label);
  return [...stack.slice(0, -1), entry(path, label, t?.root === true)];
}

// a fresh start at `path` (Home, a nav drawer item): the page has nothing of its own to go back to
export function reset(stack: NavStack, path: string, label: string | null = null): NavStack {
  const t = top(stack);
  if (t?.path === path) return [...stack.slice(0, -1), entry(path, label ?? t.label, true)];
  return capped([...stack, entry(path, label, true)]);
}

// a new stack at `path`: the first page of a tab, or of a load from outside the app
export function startOver(path: string, label: string | null = null): NavStack {
  return [entry(path, label, true)];
}

// the page Back returns to, if any (a root has none)
export function previous(stack: NavStack): NavEntry | null {
  const t = top(stack);
  return t && !t.root && stack.length >= 2 ? stack[stack.length - 2] : null;
}

// the stack after a navigation of that kind
export function visit(stack: NavStack, path: string, kind: NavKind, label: string | null = null): NavStack {
  if (kind === "pop") return enter(stack, path, label);
  if (kind === "replace") return replaceTop(stack, path, label);
  return push(stack, path, label);
}

// the page at the top names itself (once its data has loaded); a page that is no longer the top changes nothing
export function relabel(stack: NavStack, path: string, label: string): NavStack {
  return top(stack)?.path === path ? sameTop(stack, label) : stack;
}

export type NavFacts = {
  // how the browser got there (notePop / noteReplace, else a push)
  kind: NavKind;
  // the nav drawer opened it
  fresh: boolean;
  // the first page of this document, and how the document was loaded ("navigate", "reload", "back_forward")
  first: boolean;
  loadType: string | null;
};

// /league/current/<page> only forwards to that page of the league being played now. Opened as a document (a bookmark, a
// shared "…/current/standings?team=29"), the app shows it for a moment and Next then swaps it for the league's page in
// the browser's history, so in the stack too the page it lands on takes its place.
function forwardsOnly(path: string): boolean {
  return path === "/league/current" || path.startsWith("/league/current/");
}

// The stack once the page at `path` is on screen. Home ("/") and a page opened from the nav drawer are roots: the
// navigation is recorded as it happened (Back to Home pops, a link pushes, a replace swaps), and then the page is made a
// root. The first page of a document keeps the stack only when it is the page the stack left off at (a reload, or Back
// into the app to that page); any other load starts a new stack.
export function nextNavStack(stack: NavStack, path: string, facts: NavFacts): NavStack {
  if (facts.first) {
    const keeps = (facts.loadType === "reload" || facts.loadType === "back_forward") && top(stack)?.path === path;
    return keeps ? stack : startOver(path);
  }
  const from = top(stack);
  const kind = facts.kind === "push" && from != null && forwardsOnly(from.path) ? "replace" : facts.kind;
  const next = visit(stack, path, kind);
  return path === "/" || facts.fresh ? reset(next, path) : next;
}

// What a stored value holds, or nothing when it isn't a stack (another version of the app, edited by hand)
export function parseNavStack(raw: string | null): NavStack {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    const ok = value.every(
      (e) => e != null && typeof e.path === "string" && (e.label === null || typeof e.label === "string") && (e.root === undefined || e.root === true)
    );
    return ok ? capped(value.map((e: NavEntry) => entry(e.path, e.label, e.root === true))) : EMPTY;
  } catch {
    return EMPTY;
  }
}

// ---------- the tab's stack (sessionStorage) ----------

const STORAGE_KEY = "bela.navStack";
const listeners = new Set<() => void>();
let snapshot: {raw: string | null; stack: NavStack} = {raw: null, stack: EMPTY};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // storage blocked (private mode settings): the stack lives only as long as the page
    return null;
  }
}

// what is stored (the same object until it changes, as useSyncExternalStore needs)
export function readNavStack(): NavStack {
  const s = storage();
  let raw = snapshot.raw;
  try {
    if (s) raw = s.getItem(STORAGE_KEY);
  } catch {
    // unreadable: keep what this page has
  }
  if (raw !== snapshot.raw) snapshot = {raw, stack: parseNavStack(raw)};
  return snapshot.stack;
}

export function serverNavStack(): NavStack {
  return EMPTY;
}

export function writeNavStack(stack: NavStack) {
  const raw = JSON.stringify(stack);
  readNavStack();
  if (raw === snapshot.raw) return;
  try {
    storage()?.setItem(STORAGE_KEY, raw);
  } catch {
    // full or blocked: keep it in memory
  }
  snapshot = {raw, stack};
  listeners.forEach((l) => l());
}

export function subscribeNavStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// the page at the top gives its name (for the next page's back pill)
export function labelNavEntry(path: string, label: string) {
  writeNavStack(relabel(readNavStack(), path, label));
}

// ---------- the navigation on its way ----------

// set by a popstate (Back/Forward), by useTransitionRouter().replace and by the nav drawer; read once the new page is
// on screen
let popTo: string | null = null;
let replaceTo: string | null = null;
let freshNext = false;

export function notePop(path: string) {
  popTo = path;
}

export function noteReplace(path: string) {
  replaceTo = path;
}

// A nav drawer item to `path` was chosen while `here` is shown: the page it opens is a root, whatever path it ends on
// (/league/current/... lands on the league being played now). The stack changes once that page is on screen, so the
// page that is leaving doesn't redraw its Back first; the item of the page shown makes it a root at once.
export function startNavStack(path: string, here: string) {
  if (path === here) writeNavStack(reset(readNavStack(), path));
  else freshNext = true;
}

// what is known about the navigation to `path`, without forgetting it (a page asking before it is recorded)
function peekFacts(path: string): Pick<NavFacts, "kind" | "fresh"> {
  return {kind: popTo === path ? "pop" : replaceTo === path ? "replace" : "push", fresh: freshNext};
}

// The stack as it will be once the navigation to `path` is recorded (a page renders before <RouteTransitions /> records
// the navigation that brought it)
export function previewNavStack(stack: NavStack, path: string): NavStack {
  return top(stack)?.path === path ? stack : nextNavStack(stack, path, {...peekFacts(path), first: false, loadType: null});
}

// how the page on screen was reached, once recorded (the first page of a document counts as a push)
let arrived: {path: string; kind: NavKind} | null = null;

// The page at `path` came on screen; first = the first page of this document. Every note is used up, also one for a
// navigation that never changed the path (a replace of ?tab=).
export function recordNavigation(path: string, first: boolean, loadType: string | null) {
  const facts: NavFacts = {...peekFacts(path), first, loadType};
  popTo = null;
  replaceTo = null;
  freshNext = false;
  arrived = {path, kind: first ? "push" : facts.kind};
  writeNavStack(nextNavStack(readNavStack(), path, facts));
}

// How the page at `path` was reached: "pop" for Back or Forward. A page asks before <RouteTransitions /> records its
// navigation (while it renders) or after; both give the same answer.
export function arrivalKind(path: string): NavKind {
  if (popTo === path || replaceTo === path) return peekFacts(path).kind;
  return arrived?.path === path ? arrived.kind : "push";
}

// The place of the page at `path` in the stack (1 = the first entry), before or after its navigation is recorded: with
// the path, it names the page's entry in the tab's history (Back to a page lands on the depth it was left at)
export function stackDepth(path: string): number {
  return previewNavStack(readNavStack(), path).length;
}
