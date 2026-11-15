// Liga na dvije lokacije (LOCATIONS_PLAN.md): a league night can be played at two places at once. A team plays at
// slot 1 (the night's first place) or slot 2 (its second); Podjela puts it there. These are the rules that need no
// database, so they can be unit tested.

// The place of a two-place night a team or a table is at
export type Slot = 1 | 2;
export const SLOTS: readonly Slot[] = [1, 2];

export function isSlot(value: unknown): value is Slot {
  return value === 1 || value === 2;
}

// A place from a query string (?slot=1 or 2); anything else is none (a one-place night)
export function slotParam(value: string | null | undefined): Slot | null {
  const n = Number(value);
  return isSlot(n) ? n : null;
}

// "?slot=2" for a request about one place of a two-place night; "" on a one-place night (with: "&" after a query)
export function slotQuery(slot: Slot | null | undefined, joiner: "?" | "&" = "?"): string {
  return slot == null ? "" : `${joiner}slot=${slot}`;
}

// The other place of the night
export function otherSlot(slot: Slot): Slot {
  return slot === 1 ? 2 : 1;
}

// A night is played at two places when it has a second one
export function isTwoPlaceNight(night: {second_location_id: number | null | undefined}): boolean {
  return night.second_location_id != null;
}

// Podjela's columns and Kopiraj raspored list a place's teams alphabetically, as Croatian sorts them (Č after C, Š
// after S)
export function byTeamName<T extends {name: string}>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "hr", {sensitivity: "base"}) || a.name.localeCompare(b.name, "hr");
}

// "Podijeli po konferencijama": the first conference (by its place in the league's list) plays at the night's first
// place and the second at its second. Only a league with exactly two conferences can be split this way (null
// otherwise: the button is off). Inactive teams and teams without a conference are left as they are; every other
// team is placed, over where it was.
export function splitByConference(
  teams: readonly {team_id: number; conference_id: number | null; active: boolean}[],
  conferences: readonly {conference_id: number; position: number}[]
): Map<number, Slot> | null {
  if (conferences.length !== 2) return null;
  const [first, second] = [...conferences].sort((a, b) => a.position - b.position || a.conference_id - b.conference_id);
  const slotOf = new Map<number, Slot>([
    [first.conference_id, 1],
    [second.conference_id, 2],
  ]);
  const split = new Map<number, Slot>();
  for (const t of teams) {
    const slot = t.active && t.conference_id != null ? slotOf.get(t.conference_id) : undefined;
    if (slot) split.set(t.team_id, slot);
  }
  return split;
}

// "Zamijeni lokacije": every assigned team goes to the other place; unassigned teams stay unassigned
export function swapSlots(assigned: ReadonlyMap<number, Slot>): Map<number, Slot> {
  return new Map(Array.from(assigned, ([teamId, slot]) => [teamId, otherSlot(slot)]));
}

// "Kopiraj raspored": plain text for a message. Each place's name, then its teams one per line ("• Ime"),
// alphabetically, and a blank line before the next place. Unassigned teams aren't copied.
export function copyText(places: readonly {name: string; teams: readonly string[]}[]): string {
  return places
    .map((p) => [p.name, ...[...p.teams].map((name) => ({name})).sort(byTeamName).map((t) => `• ${t.name}`)].join("\n"))
    .join("\n\n");
}
