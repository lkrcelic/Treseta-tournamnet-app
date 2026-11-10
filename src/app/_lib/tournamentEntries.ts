// Who is in a tournament and who waits (Turniri · Prijave, Lista čekanja). A team signing up when the tournament is
// full goes on the waiting list; the list goes in the order the teams signed up, and when a team leaves the first one
// waiting comes in by itself (without a notice). A lower limit sends the last teams to sign up to the waiting list.
// Framework free so it can be unit tested.

export type EntryStatus = "REGISTERED" | "WAITING";

export type Entry = {teamId: number; status: EntryStatus; registeredAt: Date};

export type StatusChange = {teamId: number; status: EntryStatus};

const byTime = (a: Entry, b: Entry) => a.registeredAt.getTime() - b.registeredAt.getTime() || a.teamId - b.teamId;

// A team signing up (or an admin's Dodaj): in while there is room, else on the waiting list. maxTeams null: no limit
export function signUpStatus(registered: number, maxTeams: number | null): EntryStatus {
  return maxTeams == null || registered < maxTeams ? "REGISTERED" : "WAITING";
}

// The waiting list in order: the first one is the next team in
export function waitingList(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === "WAITING").sort(byTime);
}

// The changes that put the entries right for the limit: the teams waiting longest come in while there is room; with
// fewer places than teams in, the teams in that signed up last go to the waiting list, where they wait in front of the
// later sign-ups (by when they signed up). maxTeams null: no limit, everyone waiting comes in.
export function rebalance(entries: Entry[], maxTeams: number | null): StatusChange[] {
  const registered = entries.filter((e) => e.status === "REGISTERED").sort(byTime);
  const waiting = waitingList(entries);
  if (maxTeams == null) return waiting.map((e) => ({teamId: e.teamId, status: "REGISTERED"}));
  if (registered.length > maxTeams) {
    return registered.slice(maxTeams).map((e) => ({teamId: e.teamId, status: "WAITING"}));
  }
  return waiting.slice(0, maxTeams - registered.length).map((e) => ({teamId: e.teamId, status: "REGISTERED"}));
}

// The players of a team who already play in another entry of the tournament (in it or waiting): a player signs up
// with one team only. others: the other entries' rosters
export function playersInOtherEntries(playerIds: number[], others: {teamId: number; playerIds: number[]}[]): number[] {
  const taken = new Set(others.flatMap((o) => o.playerIds));
  return playerIds.filter((id) => taken.has(id));
}
