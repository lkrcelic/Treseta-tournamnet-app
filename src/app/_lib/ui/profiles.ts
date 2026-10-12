// The numbers and short texts of the Team and Player pages (handoff §6). Framework free so they can be unit tested;
// the server builds the overviews with the first four, the pages format with the rest.
import type {PlayerView} from "@/app/_interfaces/player";
import type {PlayerRatingSummary, TeamNight, TeamOverview, TeamOverviewLeague} from "@/app/_interfaces/profiles";
import {leagueEnded} from "@/app/_lib/league";
import {displayName} from "@/app/_lib/players/names";
import {count, displayDate, NOUN, plural} from "@/app/_lib/ui/text";

// ---------- Zadnje večeri (Team page) ----------

// A finished round of the team, as the server loads it
export type TeamNightRound = {
  date: string; // YYYY-MM-DD
  league_id: number;
  league_name: string;
  team1_id: number;
  team2_id: number;
  team1_wins: number;
  team2_wins: number;
  // each match's points: [pair of team 1, pair of team 2]
  scores: [number, number][];
};

// The team's nights, newest first: one per night and league (a team in two leagues can play both on one date), with
// the rounds won, drawn and lost and the point difference from the team's side. A round against the bye team counts
// like any other, as in the standings (update_team_score and get_league_standings_by_date).
export function aggregateTeamNights(rounds: TeamNightRound[], teamId: number, limit = 4): TeamNight[] {
  const nights = new Map<string, TeamNight>();
  for (const r of rounds) {
    const side = r.team1_id === teamId ? 1 : r.team2_id === teamId ? 2 : 0;
    if (!side) continue;
    const key = `${r.date}|${r.league_id}`;
    let night = nights.get(key);
    if (!night) {
      night = {date: r.date, league_id: r.league_id, league_name: r.league_name, wins: 0, draws: 0, losses: 0, diff: 0};
      nights.set(key, night);
    }
    const [own, other] = side === 1 ? [r.team1_wins, r.team2_wins] : [r.team2_wins, r.team1_wins];
    if (own > other) night.wins++;
    else if (own < other) night.losses++;
    else night.draws++;
    for (const [a, b] of r.scores) night.diff += side === 1 ? a - b : b - a;
  }
  return Array.from(nights.values())
    .sort((a, b) => b.date.localeCompare(a.date) || b.league_id - a.league_id)
    .slice(0, limit);
}

// ---------- Lige (Team page) ----------

// A league the team is in, with that league's Ukupni poredak in its own order (getLeagueStandings)
export type TeamLeagueFacts = {
  league_id: number;
  league_name: string;
  season: string | null;
  end_date: string | null; // YYYY-MM-DD
  last_night: string | null; // the league's last night
  standings: {team_id: number; rounds_played: number; score: number}[];
};

// The team's leagues: its place (the row number in Ukupni poredak, so tied teams get different places, as on the
// standings page) and points, or none before it has finished a round there; running leagues first, then the newest
export function teamLeagueRows(leagues: TeamLeagueFacts[], teamId: number, today: string): TeamOverviewLeague[] {
  return leagues
    .map((l) => {
      const index = l.standings.findIndex((s) => s.team_id === teamId);
      const row = index >= 0 ? l.standings[index] : null;
      const played = row?.rounds_played ?? 0;
      return {
        league_id: l.league_id,
        league_name: l.league_name,
        season: l.season,
        live: !leagueEnded(l.end_date, l.last_night, today),
        rank: row && played > 0 ? index + 1 : null,
        points: row && played > 0 ? row.score : null,
        played,
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live) || b.league_id - a.league_id);
}

// Najbolje mjesto: the best place over the leagues the team has played in; on a tie the first in the list (running,
// then newest). Null ("–") before the team has finished a round anywhere.
export function bestRank(leagues: TeamOverviewLeague[]): TeamOverview["stats"]["best"] {
  let best: TeamOverviewLeague | null = null;
  for (const l of leagues) {
    if (l.rank != null && (best?.rank == null || l.rank < best.rank)) best = l;
  }
  return best?.rank != null ? {rank: best.rank, league_id: best.league_id, league_name: best.league_name} : null;
}

// ---------- Ekipe (Player page) ----------

// A team's players for the chips on the Player page, in the team's rating order (the order of the Team page's Igrači,
// and of frame 13c): by their place on Rejting (the list is Rejting's, best first); anyone not on it after, by name
export function inRatingOrder<P extends {id: number; first_name: string; last_name: string}>(players: P[], list: {id: number}[]): P[] {
  const place = new Map(list.map((r, i) => [r.id, i]));
  const at = (p: P) => place.get(p.id) ?? Infinity;
  return [...players].sort((a, b) => at(a) - at(b) || displayName(a).localeCompare(displayName(b), "hr"));
}

// ---------- texts ----------

// A night's result, shown as "3 pob · 1 por", with draws "2 pob · 1 ner · 1 por" (in the standings' order
// POB · NER · IZG); the parts come separately, so a narrow column breaks the line only between them
export function nightParts(wins: number, draws: number, losses: number): string[] {
  return [`${wins} pob`, ...(draws > 0 ? [`${draws} ner`] : []), `${losses} por`];
}

// "3 igrača · 2 lige", "1 igrač · 1 liga", "0 igrača · 0 liga"
export function teamSubline(players: number, leagues: number): string {
  return `${count(players, NOUN.igrač)} · ${count(leagues, NOUN.liga)}`;
}

// A team's leagues on the Player page, newest first: "Liga A · Liga B", and " +N" for the rest; "" when none
export function playerTeamLeagues(leagues: {league_name: string}[]): string {
  const shown = leagues.slice(0, 2).map((l) => l.league_name).join(" · ");
  return leagues.length > 2 ? `${shown} +${leagues.length - 2}` : shown;
}

// One number on a cream header card: "NAJBOLJE MJESTO / #3 / Piatnik Bela Liga 2025"
export type HeroTile = {label: string; value: string; sub: string};

// The Team page's tiles (13f): Najbolje mjesto ("–" with no sub before the team has played), Igrači, Lige
export function teamTiles(stats: TeamOverview["stats"]): HeroTile[] {
  return [
    {label: "Najbolje mjesto", value: stats.best ? `#${stats.best.rank}` : "–", sub: stats.best?.league_name ?? ""},
    {label: "Igrači", value: String(stats.players), sub: "u ekipi"},
    {label: "Lige", value: String(stats.leagues), sub: `${stats.leagues_live} u tijeku`},
  ];
}

// The Player page's tiles (13g): Mjesto on Rejting ("–" for a player who isn't on it), Odigrano (rounds, "kola ·
// još privremeno" under 8 rated rounds), Ekipe with their names
export function playerTiles(rating: PlayerRatingSummary, teams: {team_name: string}[]): HeroTile[] {
  return [
    // "od" takes the genitive, "igrača" for every number (od 1 / 21 / 25 igrača)
    {label: "Mjesto", value: rating.rank != null ? `#${rating.rank}` : "–", sub: `od ${rating.total} igrača`},
    {label: "Odigrano", value: String(rating.rounds), sub: `${plural(rating.rounds, ...NOUN.kolo)}${rating.provisional ? " · još privremeno" : ""}`},
    {label: "Ekipe", value: String(teams.length), sub: teams.map((t) => t.team_name).join(", ")},
  ];
}

// A league's season as a label: only numbers (Nova liga suggests the year, "2026"; "2025/26") read "Sezona 2026", a
// season with words in it ("Jesen 2026", "Sezona 2025") stays as written; null for none
export function seasonLabel(season: string | null | undefined): string | null {
  const s = season?.trim();
  if (!s) return null;
  return /^[\d\s./–-]+$/.test(s) ? `Sezona ${s}` : s;
}

// Whether a league is being played, after its season: "Sezona 2026 · U tijeku", "Jesen 2026 · Završeno", only
// "Završeno" for a league without a season. The Team page's league rows, and (lower: the state in lower case after a
// season, "Sezona 2025 · završeno", 13d) the line under a league's Ukupni poredak opened from a team.
export function leagueStatusLine(season: string | null | undefined, live: boolean, {lower = false}: {lower?: boolean} = {}): string {
  const label = seasonLabel(season);
  const state = live ? "U tijeku" : "Završeno";
  if (!label) return state;
  return `${label} · ${lower ? state.toLowerCase() : state}`;
}

// The second line of a Team page's player: the username for an admin and the player themself (the server sends it
// only to them), the team's name for everyone else
export function rosterSubline(player: {username: string | null}, teamName: string): string {
  return player.username ? `@${player.username}` : teamName;
}

// A team's avatar: the first letter (or digit) of its name, "?" for none ("Puleni" -> "P", "đaci" -> "Đ")
export function teamInitial(name: string | null | undefined): string {
  const first = Array.from(name ?? "").find((ch) => /\d/.test(ch) || ch.toLocaleLowerCase("hr") !== ch.toLocaleUpperCase("hr"));
  return first ? first.toLocaleUpperCase("hr") : "?";
}

// The Osobni podaci rows of a Player page (P:467): first and last name for everyone; for the player themself and
// admins (full) also the username, email, phone, birth date and Pušač. A missing value is "—".
export function personalRows(player: PlayerView, full: boolean): {key: string; value: string}[] {
  const or = (v: string | null | undefined) => (v && v.trim() ? v : "—");
  const rows = [
    {key: "Ime", value: or(player.first_name)},
    {key: "Prezime", value: or(player.last_name)},
  ];
  if (!full) return rows;
  return [
    ...rows,
    {key: "Korisničko ime", value: player.username ? `@${player.username}` : "—"},
    {key: "Email", value: or(player.email)},
    {key: "Mobitel", value: or(player.phone)},
    {key: "Datum rođenja", value: player.birth_date ? `${displayDate(player.birth_date)}.` : "—"},
    {key: "Pušač", value: player.smoker ? "Da" : "Ne"},
  ];
}
