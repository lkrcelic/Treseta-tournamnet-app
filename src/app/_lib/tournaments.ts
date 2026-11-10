// Tournaments (Turniri): how far one has got, its standings and the words the screens use for it. Framework free so it
// can be unit tested.
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {count, NOUN, plural} from "@/app/_lib/ui/text";

// upcoming: before Kolo 1 is published (sign-ups); active: from then until the last Kolo is played; cancelled: Otkaži
export type TournamentPhase = "upcoming" | "active" | "finished" | "cancelled";

// One Kolo: its tables (the bye's included), how many are played and how many are being played
export type KoloSummary = {number: number; published: boolean; tables: number; done: number; live: number};

export function tournamentPhase(t: {startedAt: Date | string | null; cancelledAt: Date | string | null; rounds: number}, kolos: KoloSummary[]): TournamentPhase {
  if (t.cancelledAt) return "cancelled";
  if (!t.startedAt) return "upcoming";
  const published = kolos.filter((k) => k.published);
  const last = Math.max(0, ...published.map((k) => k.number));
  return last >= t.rounds && published.every(kolosDone) ? "finished" : "active";
}

const kolosDone = (k: KoloSummary) => k.tables > 0 && k.done === k.tables;

// Still coming up for the players (Sljedeći turnir, Nadolazeći turniri): not started and not before today. One whose day
// passed without Kolo 1 published stays "upcoming" for the admin (who can still start, move or cancel it) but isn't
// shown to the players as coming up. today: the league's date (YYYY-MM-DD).
export function isComingUp(t: {phase: TournamentPhase; date: string}, today: string): boolean {
  return t.phase === "upcoming" && t.date >= today;
}

// The Kolos played to the end ("Nakon 2 od 9 kola")
export function completedKolos(kolos: KoloSummary[]): number {
  return kolos.filter((k) => k.published && kolosDone(k)).length;
}

// The Kolo being played: the last one published while it isn't over; null before Kolo 1 and between Kolos
export function liveKolo(kolos: KoloSummary[]): number | null {
  const published = kolos.filter((k) => k.published).sort((a, b) => b.number - a.number);
  return published.length > 0 && !kolosDone(published[0]) ? published[0].number : null;
}

// The tournament's last Kolo is made (a draft or published): there is no next Kolo to join, so Tu smo · Želimo
// uskočiti isn't offered any more
export function lastKoloMade(kolos: KoloSummary[], rounds: number): boolean {
  return kolos.some((k) => k.number >= rounds);
}

/**
 * Whether a team can sign up at this very moment (Otvorene prijave, DECISIONS #88).
 *
 * A closed tournament takes teams only before it starts — the start time shuts the sign-ups for good. An open one
 * takes them all through the tournament, until its last Kolo is made (a draft counts): after that there is no next
 * Kolo to come into, the same line the Tu smo · Želimo uskočiti button stops at. The admin's own Prijave switch wins
 * over both, and a cancelled or finished tournament takes nobody.
 */
export function signUpsOpenNow(t: {phase: TournamentPhase; registrationsOpen: boolean; openSignups: boolean; lastKoloMade: boolean}): boolean {
  if (!t.registrationsOpen) return false;
  if (t.phase === "upcoming") return true;
  return t.phase === "active" && t.openSignups && !t.lastKoloMade;
}

/**
 * Whether a team coming in now counts as present, so its entry is written with Tu smo and active and the next Kolo's
 * draft pairs it (DECISIONS #88, your words: "ako su se prijavili podrazumijeva se da su tamo").
 *
 * That starts at the **start time**, not at Kolo 1: between the two the day's switch has already decided who is here,
 * so a team that signs up then is just as much here as one that signs up while a Kolo is played. Only a tournament
 * with Otvorene prijave does this — a closed one keeps the old flow, where a team added late is marked by the admin.
 */
export function joinsAsPresent(t: {openSignups: boolean; dayClosed: boolean}): boolean {
  return t.openSignups && t.dayClosed;
}

/**
 * Switching Otvorene prijave off while the tournament is played closes the sign-ups with it. The database refuses a
 * started tournament that keeps them open (Tournament_started_check), so without this the save would be a 500.
 */
export function signUpsCloseWithSwitch(t: {started: boolean; registrationsOpen: boolean; openSignupsAfter: boolean}): boolean {
  return t.started && t.registrationsOpen && !t.openSignupsAfter;
}

// The most Kolos a tournament has (Tournament_rounds_check)
export const KOLO_MAX = 20;

/**
 * Obriši kolo on the admin's Kola: **any** Kolo can go, whatever its state (DECISIONS #87) — still to come, a draft,
 * out, being played or played. The tournament always has one Kolo less afterwards, and the Kolos after the deleted
 * one move up a number.
 *
 * What is actually deleted is the deleted Kolo's tables **and those of every made Kolo after it**, because those were
 * paired by its results. So deleting a Kolo nobody has made yet deletes nothing at all: it is only a line in the plan.
 * Deleting Kolo 1 of a tournament being played clears what was played and leaves the plan one Kolo shorter, ready to
 * be made again.
 *
 * One Kolo always stays, so a tournament of one Kolo can't lose it. `step` is what this Kolo is; `alsoGo` are the made
 * Kolos after it that go too; `rounds` is what the tournament is left with; `resultsGo` means someone has sat down at
 * one of the tables that go, so results and ratings change; `ends` means the Kolos that stay are all played, so
 * deleting this one ends the tournament. null: this Kolo can't go.
 */
export type KoloRemoval = {
  number: number;
  step: "waiting" | "draft" | "out" | "live" | "played";
  alsoGo: number[];
  rounds: number;
  ends: boolean;
  resultsGo: boolean;
};

export type KoloState = {number: number; published: boolean; played: boolean; done: boolean};

export function koloRemovalOf(rounds: number, n: number, kolos: KoloState[]): KoloRemoval | null {
  if (n < 1 || n > rounds) return null;
  // a tournament has to keep a Kolo
  const left = rounds - 1;
  if (left < 1) return null;
  const byNumber = new Map(kolos.map((k) => [k.number, k]));
  const mine = byNumber.get(n);
  // this Kolo and every made Kolo after it: their tables go together
  const made = kolos.filter((k) => k.number >= n).map((k) => k.number).sort((a, b) => a - b);
  const step = !mine ? "waiting" : !mine.published ? "draft" : !mine.played ? "out" : mine.done ? "played" : "live";
  // what stays is Kolo 1..n-1, so the tournament is over only when the deleted one was the last and the rest are played
  const ends = left === n - 1 && Array.from({length: n - 1}, (_, i) => byNumber.get(i + 1)).every((k) => k != null && k.published && k.done);
  const resultsGo = kolos.some((k) => k.number >= n && k.played);
  return {number: n, step, alsoGo: made.filter((x) => x !== n), rounds: left, ends, resultsGo};
}

// Deleting this Kolo deletes results too: its own, or those of the made Kolos that go with it. The confirmation then
// reads "Obriši s rezultatima" and the request carries ?rezultati=1.
export const removesResults = (r: KoloRemoval) => r.resultsGo;

// Anything but a Kolo nobody has made yet: the confirmation says what the deletion costs and carries the warning sign
export const koloRemovalWarns = (r: KoloRemoval) => r.step !== "waiting" || r.alsoGo.length > 0;

/**
 * Someone has sat down at this table: it is closed, a match was played at it, or one is being played. Word for word
 * the question the server asks before it deletes a Kolo (deleteKolo), so the confirmation and the refusal can never
 * disagree — a table whose match an admin finished without a winner is open with no wins on it, and reading only the
 * wins left the dialog saying plain "Obriši kolo" while the server refused and asked for the results to be confirmed,
 * which that dialog could not then offer. The bye's table is nobody's play.
 */
export function tableWasPlayed(t: {team1Id: number; team2Id: number; open: boolean; matches: number; ongoing: number}): boolean {
  if (isByeTeam(t.team1Id) || isByeTeam(t.team2Id)) return false;
  return !t.open || t.matches > 0 || t.ongoing > 0;
}

// Each of the tournament's Kolos as the admin's list shows it (Kola): played, being played, a draft waiting to be
// published, or still to come
export type KoloStep = "played" | "live" | "draft" | "waiting";

export function koloSteps(rounds: number, kolos: KoloSummary[]): {number: number; step: KoloStep}[] {
  const byNumber = new Map(kolos.map((k) => [k.number, k]));
  const last = Math.max(rounds, ...kolos.map((k) => k.number));
  return Array.from({length: last}, (_, i) => {
    const k = byNumber.get(i + 1);
    const step: KoloStep = !k ? "waiting" : !k.published ? "draft" : kolosDone(k) ? "played" : "live";
    return {number: i + 1, step};
  });
}

// A Kolo's draft seats other teams than the ones that play now: one joined, left, or was excluded or let back after it
// was made (Kolo 1 before the start, any later Kolo made by itself when the Kolo before it ended). It has to be made
// again before it is published. The bye is not a team.
export function draftIsStale(draft: {team1Id: number; team2Id: number}[], playing: number[]): boolean {
  if (draft.length === 0) return false;
  const seated = new Set(draft.flatMap((t) => [t.team1Id, t.team2Id]).filter((id) => !isByeTeam(id)));
  return seated.size !== new Set(playing).size || playing.some((id) => !seated.has(id));
}

// ---------- standings ----------

// A published table as the standings read it
export type TableResult = {
  kolo: number;
  team1Id: number;
  team2Id: number;
  team1Wins: number;
  team2Wins: number;
  open: boolean;
  // play has started at it (a match is running or was played)
  started: boolean;
  // team1's points minus team2's, over the matches played
  diff: number;
  // false for a skipped table (Nedolazak za stol: nobody started or answered in 8 minutes): it isn't counted
  scored: boolean;
  // the matches the table plays (Partija po kolu, 2 or 1): a match is worth a point, so a table won is worth that many
  matches: number;
};

export type TeamTotals = {
  teamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  // a win 2 (1 with one match a table), a draw 1
  points: number;
  difference: number;
  // a table of the team is being played
  live: boolean;
};

// Every team's totals from the tables played to the end, as in the league: a table won (more matches won) is a win,
// worth a point a match (2, or 1 with one match a table), equal matches a draw (1); the difference is of the points of
// every match played, the bye's 5:0 matches and a no-show's too (it is scored as a bye). A skipped table counts for nobody. Teams
// without a table yet have zeros.
export function tournamentTotals(teamIds: number[], tables: TableResult[]): Map<number, TeamTotals> {
  const totals = new Map<number, TeamTotals>(
    teamIds.map((id) => [id, {teamId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, difference: 0, live: false}])
  );
  const side = (id: number) => {
    if (isByeTeam(id)) return null;
    let t = totals.get(id);
    if (!t) {
      // a team that left the tournament after it played keeps its results
      t = {teamId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, difference: 0, live: false};
      totals.set(id, t);
    }
    return t;
  };
  for (const table of tables) {
    const sides: [TeamTotals | null, number, number, number][] = [
      [side(table.team1Id), table.team1Wins, table.team2Wins, table.diff],
      [side(table.team2Id), table.team2Wins, table.team1Wins, -table.diff],
    ];
    for (const [t, won, lost, diff] of sides) {
      if (!t) continue;
      if (table.open) {
        if (table.started) t.live = true;
        continue;
      }
      if (!table.scored) continue;
      t.played += 1;
      if (won > lost) {
        t.wins += 1;
        t.points += table.matches;
      } else if (won === lost) {
        t.draws += 1;
        t.points += 1;
      } else t.losses += 1;
      t.difference += diff;
    }
  }
  return totals;
}

// The standings order: points, then the difference, then the head-to-head ("međusobni omjer"): among the teams level
// on both, the points and then the difference of only the tables they played against each other; then the name. Without
// tables only points, difference and name count.
export function rankTeams<T extends {name: string; totals: TeamTotals}>(teams: T[], tables: TableResult[] = []): T[] {
  const sorted = [...teams].sort(
    (a, b) => b.totals.points - a.totals.points || b.totals.difference - a.totals.difference || a.name.localeCompare(b.name, "hr")
  );
  const out: T[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].totals.points === sorted[i].totals.points && sorted[j].totals.difference === sorted[i].totals.difference) j++;
    const group = sorted.slice(i, j);
    if (group.length > 1 && tables.length > 0) {
      const ids = new Set(group.map((t) => t.totals.teamId));
      const mutual = tournamentTotals(Array.from(ids), tables.filter((t) => ids.has(t.team1Id) && ids.has(t.team2Id)));
      const h2h = (t: T) => mutual.get(t.totals.teamId)!;
      group.sort((a, b) => h2h(b).points - h2h(a).points || h2h(b).difference - h2h(a).difference || a.name.localeCompare(b.name, "hr"));
    }
    out.push(...group);
    i = j;
  }
  return out;
}

// Every team's opponents so far, for the next Kolo's pairing (the bye counts as an opponent, BYE_TEAM_ID)
export function opponentsOf(tables: TableResult[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const add = (team: number, opponent: number) => {
    if (isByeTeam(team)) return;
    out.set(team, [...(out.get(team) ?? []), isByeTeam(opponent) ? BYE_TEAM_ID : opponent]);
  };
  for (const t of tables) {
    add(t.team1Id, t.team2Id);
    add(t.team2Id, t.team1Id);
  }
  return out;
}

// ---------- words ----------

// "Danas", "Sutra", "Za 6 dana" before the day; "" after it (today: YYYY-MM-DD in league time)
export function daysUntilLabel(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return "";
  if (days === 0) return "Danas";
  if (days === 1) return "Sutra";
  return `Za ${days} ${plural(days, "dan", "dana", "dana")}`;
}

// Pravila igre's line: Trešeta's own match, to MATCH_THRESHOLD with "s ovim dosta", with zvanja or without
export function rulesLabel(declarations: boolean): string {
  return `${MATCH_THRESHOLD} · s ovim dosta · ${declarations ? "zvanja" : "bez zvanja"}`;
}

// How the standings are ordered, as Poredak tells the admin: a win is worth 1 with one match a table (no draws then)
export function standingsOrderLabel(matchesPerRound: number): string {
  const points = matchesPerRound === 1 ? "pobjeda 1" : "pobjeda 2, neriješeno 1";
  return `Redoslijed: bodovi (${points}), pa razlika bodova, pa međusobni omjer na turniru.`;
}

// The format line: "9 kola" (two matches a table, as in a league) or "9 kola · 1 partija po kolu"
export function formatLabel(rounds: number, matchesPerRound: number): string {
  const kola = count(rounds, NOUN.kolo);
  return matchesPerRound === 1 ? `${kola} · 1 partija po kolu` : kola;
}

// The entry fee's row: "Kotizacija 20 € po igraču" (paid on the day), or no fee: "Bez stresa, bez obveza"
export function feeLabel(entryFee: number): {title: string; sub: string; free: boolean} {
  return entryFee > 0
    ? {title: `Kotizacija ${entryFee} € po igraču`, sub: "Plaća se na dan turnira", free: false}
    : {title: "Bez stresa, bez obveza", sub: "Nema kotizacije", free: true};
}

export type Prize = {place: number; prize: string; description: string};

const MONEY = /^\s*(\d+(?:[.,]\d+)?)\s*€\s*$/;

// "prvo mjesto", "prva dva mjesta", "prva tri mjesta", "prvih 5 mjesta"
function placesLabel(n: number): string {
  if (n === 1) return "prvo mjesto";
  if (n === 2) return "prva dva mjesta";
  if (n === 3) return "prva tri mjesta";
  if (n === 4) return "prva četiri mjesta";
  return `prvih ${n} mjesta`;
}

// The closed Nagrade card's line: "Ukupno 600 € · prva tri mjesta" when every prize is an amount in euros, else the
// prizes themselves ("Pehar, Medalje · prva tri mjesta"); null without prizes
export function prizeSummary(prizes: Prize[]): string | null {
  if (prizes.length === 0) return null;
  const places = placesLabel(prizes.length);
  const amounts = prizes.map((p) => MONEY.exec(p.prize));
  if (amounts.every((m) => m != null)) {
    const total = amounts.reduce((sum, m) => sum + Number(m![1].replace(",", ".")), 0);
    return `Ukupno ${Number.isInteger(total) ? total : total.toFixed(2).replace(".", ",")} € · ${places}`;
  }
  const names = Array.from(new Set(prizes.map((p) => p.prize.trim()).filter(Boolean)));
  return `${names.join(", ")} · ${places}`;
}

// "22 / 24" with a limit, "22" without one
export function capacityLabel(registered: number, maxTeams: number | null): string {
  return maxTeams == null ? String(registered) : `${registered} / ${maxTeams}`;
}

// The admin's status of a tournament (Turniri list): what it needs next, in the list's words
export type TournamentStatusLabel =
  | {kind: "cancelled"; label: "Otkazan"}
  | {kind: "finished"; label: "Završeno"}
  | {kind: "live"; label: "Uživo"}
  | {kind: "waiting"; label: string}
  | {kind: "open"; label: "Prijave otvorene"}
  | {kind: "closed"; label: "Prijave zatvorene"};

export function tournamentStatus(phase: TournamentPhase, registrationsOpen: boolean, waiting: number): TournamentStatusLabel {
  if (phase === "cancelled") return {kind: "cancelled", label: "Otkazan"};
  if (phase === "finished") return {kind: "finished", label: "Završeno"};
  if (phase === "active") return {kind: "live", label: "Uživo"};
  if (waiting > 0) return {kind: "waiting", label: `Lista čekanja · ${waiting}`};
  return registrationsOpen ? {kind: "open", label: "Prijave otvorene"} : {kind: "closed", label: "Prijave zatvorene"};
}
