// What a table page belongs to: a league's night (/league/<id>/daily-standings/table/<roundId>) or a tournament's
// Kolo (/turniri/<id>/stol/<roundId>). The table pages (the admin's scorepad, Pregled stola) are the same for both;
// only their links back and to Tko igra differ. Framework free so it can be unit tested.

export type TableScope = {kind: "league"; id: number} | {kind: "tournament"; id: number};

// From the route's params: a league's table has leagueId, a tournament's id
export function tableScopeOf(params: {leagueId?: string; id?: string}): TableScope {
  return params.leagueId != null ? {kind: "league", id: Number(params.leagueId)} : {kind: "tournament", id: Number(params.id)};
}

export function tableHref(scope: TableScope, roundId: number): string {
  return scope.kind === "league" ? `/league/${scope.id}/daily-standings/table/${roundId}` : `/turniri/${scope.id}/stol/${roundId}`;
}

// Tko igra for the admin, coming back to this table
export function adminLineupHref(scope: TableScope, roundId: number): string {
  return `/round/lineup/${roundId}?${scope.kind === "league" ? "league" : "turnir"}=${scope.id}`;
}

// The round a table is in: a league's night on Dnevni poredak; a tournament's Kolo (the admin's Kola, a player's
// Poredak i rezultati). null round or date: the page itself.
export function roundHref(scope: TableScope, {date, roundNumber, admin}: {date: string | null; roundNumber: number | null; admin: boolean}): string {
  if (scope.kind === "league") {
    return `/league/${scope.id}/daily-standings${date ? `?date=${date}${roundNumber ? `&round=${roundNumber}` : ""}` : ""}`;
  }
  if (admin) return `/turniri/${scope.id}/upravljanje?view=kola${roundNumber ? `&kolo=${roundNumber}` : ""}`;
  return `/turniri/${scope.id}/poredak${roundNumber ? `?kolo=${roundNumber}` : ""}`;
}

// What the way back is called when there is no round to name
export const scopeHomeLabel = (scope: TableScope) => (scope.kind === "league" ? "Dnevni poredak" : "Turnir");

// How the admin's scorepad goes back to its round: Back, when the round's page is the entry before it; by the round's
// address when the tab has no history, or when the document was loaded at the table itself (a reload, a link from
// outside), as what is behind it then isn't known: a reload in the middle of a hand leaves the hand's steps there.
export function roundBackBy(loadedAt: string | null, tablePath: string, historyLength: number): "back" | "address" {
  return historyLength > 1 && loadedAt !== tablePath ? "back" : "address";
}
