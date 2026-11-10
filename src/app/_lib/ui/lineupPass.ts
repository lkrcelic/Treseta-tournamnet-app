// Tko igra before a table's scorepad: an admin who opens a table confirms who plays (or played) it first, every
// time. Confirming lets this visit through: the scorepad and Tko igra of that round can go back and forth, and
// leaving them (or reloading the page) asks again.

let passed: number | null = null;

export function passLineup(roundId: number) {
  passed = roundId;
}

export function lineupPassed(roundId: number): boolean {
  return passed === roundId;
}

// The round's scorepad (a league night's table or a tournament's) or Tko igra
export function onRoundPages(roundId: number, pathname: string): boolean {
  return pathname.endsWith(`/daily-standings/table/${roundId}`) || new RegExp(`^/turniri/\\d+/stol/${roundId}$`).test(pathname) || pathname === `/round/lineup/${roundId}`;
}

// Called as either page unmounts: once the next page is in, the pass ends unless it is the other one of the round
// (a check right away would still see the old address, and a remount, as in development, never leaves it)
export function leaveRoundPages(roundId: number) {
  window.setTimeout(() => {
    if (passed === roundId && !onRoundPages(roundId, window.location.pathname)) passed = null;
  }, 0);
}
