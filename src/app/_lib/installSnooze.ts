// "Nastavi u pregledniku" (or a swipe away) on the install sheet is remembered on this phone, so Početna doesn't offer
// the install again on the next visit. On a league night a player in the browser comes back to Početna after every
// round (Kraj kola → Početni zaslon), and the sheet used to slide over Započni igru every time. After SNOOZE_DAYS the
// sheet offers again; the login page offers whatever is stored (InstallSheet's `ignoreSnooze`).

const KEY = "bela.installDismissed";
export const SNOOZE_DAYS = 7;
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

// Is the stored dismissal still recent? Nothing stored, an unreadable value, one older than the week, or one in the
// future (a clock set back) means "offer the sheet again" — the worst case is one sheet too many.
export function snoozed(stored: string | null, now: number): boolean {
  const at = Number(stored);
  if (!stored || !Number.isFinite(at)) return false;
  const since = now - at;
  return since >= 0 && since < SNOOZE_MS;
}

// Whether the sheet is snoozed on this phone (storage that isn't available reads as "not snoozed")
export function installSnoozed(now: number = Date.now()): boolean {
  try {
    return snoozed(window.localStorage.getItem(KEY), now);
  } catch {
    return false;
  }
}

export function rememberInstallDismissed(now: number = Date.now()) {
  try {
    window.localStorage.setItem(KEY, String(now));
  } catch {
    // private mode: the sheet may open again on the next visit
  }
}
