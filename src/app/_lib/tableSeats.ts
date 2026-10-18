import {isByeTeam} from "@/app/_lib/bye";

// Re-pairing a table of a round (Dnevni poredak's and Skica's Uredi stolove): who sits where afterwards. The server
// seats the teams by it, and the pair dialog tells the admin from it what else changes. Framework free so it can be
// unit tested.

// The seats of a round after `tableId` gets `wanted` (team1, team2). A team taken from another table leaves its seat
// there to a team leaving this one, so every team keeps playing once; a team leaving with nobody to take its place
// doesn't play the round. The bye is no team: several tables can have it, so picking it takes nobody from another
// table. Returns a new map; the input is not changed.
export function planSeats(seats: Map<number, [number, number]>, tableId: number, wanted: [number, number]): Map<number, [number, number]> {
  const out = new Map(Array.from(seats, ([id, pair]) => [id, [pair[0], pair[1]] as [number, number]]));
  const old = out.get(tableId)!;
  const leaving = old.filter((id) => !wanted.includes(id));
  for (const team of wanted) {
    if (old.includes(team) || isByeTeam(team)) continue;
    for (const [id, pair] of Array.from(out)) {
      if (id === tableId) continue;
      const k = pair.indexOf(team);
      if (k >= 0) {
        // as many teams leave as come, so one is always there
        pair[k] = leaving.shift()!;
        break;
      }
    }
  }
  out.set(tableId, [wanted[0], wanted[1]]);
  return out;
}
