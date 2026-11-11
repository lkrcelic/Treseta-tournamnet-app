import {isByeTeam, teamLabel} from "@/app/_lib/bye";
import {Viewer} from "@/app/_lib/players/privacy";
import {
  AdminTournament,
  ArrivalSummary,
  EntryArrival,
  EntryExclusion,
  EntryPlayer,
  KoloTable,
  KoloView,
  MyEntry,
  MyMatch,
  TournamentCard,
  TournamentEntryView,
  TournamentResults,
  TournamentStandingsItem,
  TournamentDay,
  TournamentWinner,
} from "@/app/_interfaces/tournament";
import {waitingList} from "@/app/_lib/tournamentEntries";
import {draftIsStale, lastKoloMade, signUpsOpenNow} from "@/app/_lib/tournaments";
import {leagueClock} from "@/app/_lib/dates";
import {displayName} from "@/app/_lib/players/names";
import {arrivalPhase, DayEntry, isTournamentDay, startSwitch} from "@/app/_lib/tournamentDay";
import {tableState} from "@/app/_lib/tableState";
import {windowOf} from "./day";
import {LoadedEntry, LoadedPlayer, LoadedTable, Snapshot, tableStarted} from "./load";

// The tournament API's answers, built from a snapshot (load.ts) for the viewer: the username of every player (it is
// public, #88, so a logged-out visitor sees it too), the ratings only for someone logged in, and the viewer's own
// team picked out.

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function entryPlayer(p: LoadedPlayer): EntryPlayer {
  return {id: p.id, name: p.name, photo_url: p.photo_url, username: p.username};
}

// The average rating of a team's players (null without players or for a visitor)
function teamRating(e: LoadedEntry, viewer: Viewer | null): number | null {
  if (!viewer || e.players.length === 0) return null;
  return Math.round(e.players.reduce((sum, p) => sum + p.rating, 0) / e.players.length);
}

// The viewer's entry: the one whose players include them (in it or waiting)
export function myEntryOf(s: Snapshot, viewer: Viewer | null): LoadedEntry | null {
  if (!viewer) return null;
  return s.entries.find((e) => e.players.some((p) => p.id === viewer.id)) ?? null;
}

function positionOf(s: Snapshot, teamId: number): number | null {
  const i = waitingList(s.entries.map((e) => ({teamId: e.team_id, status: e.status, registeredAt: e.registered_at}))).findIndex((e) => e.teamId === teamId);
  return i >= 0 ? i + 1 : null;
}

const arrivalOf = (e: LoadedEntry): EntryArrival | null =>
  e.arrived_at ? {at: e.arrived_at.toISOString(), by: e.arrived_by_name, admin: e.arrived_by_admin} : null;

const exclusionOf = (e: LoadedEntry): EntryExclusion | null =>
  e.excluded_at && e.excluded_reason ? {at: e.excluded_at.toISOString(), kolo: e.excluded_kolo, reason: e.excluded_reason} : null;

// The day as the tournament's rules read it
const dayEntries = (s: Snapshot): DayEntry[] =>
  s.entries.map((e) => ({
    teamId: e.team_id,
    status: e.status,
    registeredAt: e.registered_at,
    arrived: e.arrived_at != null,
    active: e.active,
    excluded: e.excluded_at != null,
  }));

export function dayOf(s: Snapshot, now: Date): TournamentDay | null {
  const window = windowOf(s.tournament);
  if (!window || s.phase === "cancelled") return null;
  const closedAt = s.tournament.arrival_closed_at ?? s.tournament.started_at;
  return {opens: window.opens.toISOString(), closes: window.closes.toISOString(), phase: arrivalPhase(window, now, closedAt)};
}

export function entryView(s: Snapshot, e: LoadedEntry, viewer: Viewer | null): TournamentEntryView {
  return {
    team_id: e.team_id,
    team_name: e.team_name,
    photo_url: e.photo_url,
    players: e.players.map(entryPlayer),
    rating: teamRating(e, viewer),
    status: e.status,
    registered_at: e.registered_at.toISOString(),
    position: e.status === "WAITING" ? positionOf(s, e.team_id) : null,
    mine: viewer != null && e.players.some((p) => p.id === viewer.id),
    arrival: arrivalOf(e),
    active: e.active,
    excluded: exclusionOf(e),
  };
}

// The Kolo a team that joined during the tournament plays from: the next one, once the Kolo being played is over
function playsFrom(s: Snapshot, e: LoadedEntry): number | null {
  if (!s.tournament.started_at || e.status !== "REGISTERED" || !e.active || e.excluded_at) return null;
  const seatedInLast = s.tables.some((t) => t.status === "PUBLISHED" && t.kolo === lastOut(s) && (t.team1_id === e.team_id || t.team2_id === e.team_id));
  return seatedInLast ? null : lastOut(s) + 1;
}

const lastOut = (s: Snapshot) => Math.max(0, ...s.kolos.filter((k) => k.published).map((k) => k.number));

// Who of a team played its tables (Tko igra), else its players
function playedBy(s: Snapshot, teamId: number): string[] {
  const entry = s.entries.find((e) => e.team_id === teamId);
  const ids = new Set(s.tables.filter((t) => t.status === "PUBLISHED").flatMap((t) => t.lineup.filter((l) => l.team_id === teamId).map((l) => l.player_id)));
  const names = entry?.players.filter((p) => ids.has(p.id)).map((p) => p.name) ?? [];
  return names.length > 0 ? names : (entry?.players.map((p) => p.name) ?? []);
}

function winnerOf(s: Snapshot): TournamentWinner | null {
  if (s.phase !== "finished" || s.standings.length === 0) return null;
  const top = s.standings[0];
  return {
    team_id: top.team_id,
    team_name: top.name,
    photo_url: s.teams.get(top.team_id)?.photo_url ?? null,
    players: playedBy(s, top.team_id),
    wins: top.totals.wins,
    draws: top.totals.draws,
    losses: top.totals.losses,
  };
}

export function cardView(s: Snapshot, viewer: Viewer | null): TournamentCard {
  const t = s.tournament;
  // whoever runs THIS tournament: an admin any, an organizer the one they made (load.ts sets it)
  const admin = s.admin;
  const registered = s.entries.filter((e) => e.status === "REGISTERED");
  const mine = myEntryOf(s, viewer);
  const me: MyEntry | null = mine
    ? {
        team_id: mine.team_id,
        team_name: mine.team_name,
        status: mine.status,
        position: mine.status === "WAITING" ? positionOf(s, mine.team_id) : null,
        players: mine.players.map(entryPlayer),
        arrival: arrivalOf(mine),
        active: mine.active,
        excluded: exclusionOf(mine),
        plays_from: playsFrom(s, mine),
      }
    : null;
  const now = new Date();
  const place = mine && mine.status === "REGISTERED" && s.phase === "finished" ? s.standings.findIndex((r) => r.team_id === mine.team_id) + 1 : 0;
  return {
    id: t.tournament_id,
    name: t.tournament_name,
    date: isoDay(t.date),
    gathering_time: t.gathering_time,
    start_time: t.start_time,
    location: {name: t.location_name, address: t.location_address, url: t.location_url},
    rounds: t.rounds,
    matches_per_round: t.matches_per_round,
    declarations: t.declarations,
    score_threshold: t.score_threshold,
    match_end: t.match_end,
    entry_fee: t.entry_fee,
    max_teams: t.max_teams,
    registrations_open: t.registrations_open,
    phase: s.phase,
    teams: registered.length,
    waiting: s.entries.length - registered.length,
    players: new Set(registered.flatMap((e) => e.players.map((p) => p.id))).size,
    avatars: registered.flatMap((e) => e.players).slice(0, 3).map((p) => ({name: p.name, photo_url: p.photo_url})),
    completed_kolos: s.completed,
    live_kolo: s.live,
    winner: winnerOf(s),
    me,
    my_place: place > 0 ? place : null,
    game_minutes: t.game_minutes,
    auto_publish: t.auto_publish,
    open_signups: t.open_signups,
    // whether a team can still sign up right now: before the start as ever, and during a tournament with Otvorene
    // prijave until its last Kolo is made (DECISIONS #88)
    signups_open_now: signUpsOpenNow({
      phase: s.phase,
      registrationsOpen: t.registrations_open,
      openSignups: t.open_signups,
      lastKoloMade: lastKoloMade(s.kolos, t.rounds),
    }),
    day: dayOf(s, now),
    last_kolo_made: lastKoloMade(s.kolos, t.rounds),
    server_now: now.toISOString(),
    can_manage: admin,
    ...(admin && {cancelled_info: t.cancelled_at ? {by: t.canceller ? displayName(t.canceller) : null, at: t.cancelled_at.toISOString()} : null}),
  };
}

// The teams in: the viewer's first, then by rating, then by name
export function entriesList(s: Snapshot, viewer: Viewer | null): TournamentEntryView[] {
  return s.entries
    .filter((e) => e.status === "REGISTERED")
    .map((e) => entryView(s, e, viewer))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || (b.rating ?? 0) - (a.rating ?? 0) || a.team_name.localeCompare(b.team_name, "hr"));
}

// The viewer's team's tables, Kolo by Kolo, the viewer's team first (Vaši mečevi)
export function myMatches(s: Snapshot, viewer: Viewer | null): MyMatch[] {
  const mine = myEntryOf(s, viewer);
  if (!mine) return [];
  return s.tables
    .filter((t) => t.status === "PUBLISHED" && (t.team1_id === mine.team_id || t.team2_id === mine.team_id))
    .map((t): MyMatch => {
      const first = t.team1_id === mine.team_id;
      const opponentId = first ? t.team2_id : t.team1_id;
      return {
        kolo: t.kolo,
        round_id: t.id,
        opponent: teamLabel(opponentId, s.teams.get(opponentId)?.name ?? ""),
        opponent_id: opponentId,
        wins: first ? [t.team1_wins, t.team2_wins] : [t.team2_wins, t.team1_wins],
        done: !t.open,
        bye: isByeTeam(opponentId),
      };
    })
    .sort((a, b) => a.kolo - b.kolo);
}

function koloTable(s: Snapshot, t: LoadedTable, now: Date): KoloTable {
  const team = (id: number) => ({team_name: teamLabel(id, s.teams.get(id)?.name ?? `Ekipa ${id}`), photo_url: s.teams.get(id)?.photo_url ?? null});
  const name = (id: number | null) => (id == null ? null : team(id).team_name);
  const other = t.attendance_team_id == null ? null : t.attendance_team_id === t.team1_id ? t.team2_id : t.team1_id;
  const state = tableState(
    {
      status: t.status,
      open: t.open,
      bye: isByeTeam(t.team1_id) || isByeTeam(t.team2_id),
      published_at: t.published_at,
      started: tableStarted(t),
      attendance: t.attendance,
      attendance_at: t.attendance_at,
      answered_by: name(t.attendance_team_id),
      other: name(other),
      matches: t.matches,
      team1: team(t.team1_id).team_name,
      team2: team(t.team2_id).team_name,
      matches_per_round: t.matches_per_round,
      today: isTournamentDay(s.tournament.date, now),
    },
    now,
    // the table's own Vrijeme partije when an admin set one unlocking it, else the tournament's (DECISIONS #89)
    t.game_minutes ?? s.tournament.game_minutes,
    leagueClock
  );
  return {
    id: t.id,
    table_number: t.table_number,
    smoking_table: t.smoking_table,
    team1_id: t.team1_id,
    team2_id: t.team2_id,
    team1: team(t.team1_id),
    team2: team(t.team2_id),
    team1_wins: t.team1_wins,
    team2_wins: t.team2_wins,
    // a match is being played at it (as the league's rounds: active)
    active: t.open && (t.active || t.ongoing != null),
    open: t.open,
    ongoingMatches: t.ongoing ? [{player_pair1_score: t.ongoing.player_pair1_score, player_pair2_score: t.ongoing.player_pair2_score}] : [],
    matches: t.matches.map((m) => ({player_pair1_score: m.score1, player_pair2_score: m.score2})),
    status: t.status,
    state,
  };
}

export function resultsView(s: Snapshot, viewer: Viewer | null): TournamentResults {
  const t = s.tournament;
  const mine = myEntryOf(s, viewer);
  const standings: TournamentStandingsItem[] = s.standings.map((r) => ({
    id: r.team_id,
    team_id: r.team_id,
    team: {team_name: r.name},
    rounds_played: r.totals.played,
    wins: r.totals.wins,
    draws: r.totals.draws,
    losses: r.totals.losses,
    point_difference: r.totals.difference,
    score: r.totals.points,
    active_round_count: r.totals.live ? 1 : 0,
    photo_url: s.teams.get(r.team_id)?.photo_url ?? null,
    players: s.entries.find((e) => e.team_id === r.team_id)?.players.map((p) => p.username) ?? [],
    excluded: (() => {
      const e = s.entries.find((x) => x.team_id === r.team_id);
      return e ? exclusionOf(e) : null;
    })(),
  }));
  const now = new Date();
  const kolos: KoloView[] = s.kolos.map((k) => ({
    number: k.number,
    published: k.published,
    tables: s.tables.filter((x) => x.kolo === k.number).map((x) => koloTable(s, x, now)),
  }));
  return {
    id: t.tournament_id,
    name: t.tournament_name,
    date: isoDay(t.date),
    rounds: t.rounds,
    matches_per_round: t.matches_per_round,
    phase: s.phase,
    completed_kolos: s.completed,
    live_kolo: s.live,
    standings,
    kolos,
    my_team_id: mine && mine.status === "REGISTERED" ? mine.team_id : null,
  };
}

// The teams at the waiting draft (of any Kolo) are not the teams that play now (draftIsStale)
export function staleDraft(s: Snapshot): boolean {
  const draft = s.tables.filter((t) => t.status !== "PUBLISHED").map((t) => ({team1Id: t.team1_id, team2Id: t.team2_id}));
  const playing = s.entries.filter((e) => e.status === "REGISTERED" && e.active && !e.excluded_at).map((e) => e.team_id);
  return draftIsStale(draft, playing);
}

// Which Kolo can be made next (Složi Kolo N), and why not yet
export function nextKolo(s: Snapshot): AdminTournament["next_kolo"] {
  if (s.phase === "cancelled" || s.phase === "finished") return null;
  const published = s.kolos.filter((k) => k.published);
  const last = Math.max(0, ...published.map((k) => k.number));
  const number = last + 1;
  if (number > s.tournament.rounds) return null;
  if (number === 1) {
    // Otvorene prijave: Kolo 1 is made from whoever is here; the sign-ups go on (DECISIONS #88)
    if (s.tournament.registrations_open && !s.tournament.open_signups) return {number, ready: false, reason: "Prvo zatvori prijave, zatim složi Kolo 1."};
    if (s.entries.filter((e) => e.status === "REGISTERED" && e.active && !e.excluded_at).length < 2) return {number, ready: false, reason: "Za kolo trebaju barem dvije aktivne ekipe."};
    return {number, ready: true, reason: null};
  }
  const previous = s.kolos.find((k) => k.number === last)!;
  const playing = s.tables.filter((t) => t.kolo === last && t.open);
  if (playing.length > 0) return {number, ready: false, reason: `Kolo ${last} još traje: ${previous.done} od ${previous.tables} stolova je gotovo.`};
  return {number, ready: true, reason: null};
}

export function adminView(s: Snapshot, viewer: Viewer): AdminTournament {
  const t = s.tournament;
  const waiting = waitingList(s.entries.map((e) => ({teamId: e.team_id, status: e.status, registeredAt: e.registered_at})));
  return {
    ...cardView(s, viewer),
    rules_url: t.rules_url,
    prizes: t.prizes.map((p) => ({place: p.place, prize: p.prize, description: p.description})),
    started_at: t.started_at?.toISOString() ?? null,
    cancelled_at: t.cancelled_at?.toISOString() ?? null,
    entries: s.entries.filter((e) => e.status === "REGISTERED").map((e) => entryView(s, e, viewer)),
    waiting_list: waiting.map((w) => entryView(s, s.entries.find((e) => e.team_id === w.teamId)!, viewer)),
    results: resultsView(s, viewer),
    next_kolo: nextKolo(s),
    stale_draft: staleDraft(s),
    organizer_phone: t.organizer_phone,
    cancelled_by: t.canceller ? displayName(t.canceller) : null,
    arrival_summary: arrivalSummary(s),
  };
}

// Prijave on the tournament's day: who is here, who isn't, the waiting list, and what the start time will do
function arrivalSummary(s: Snapshot): ArrivalSummary | null {
  if (s.phase === "cancelled") return null;
  const day = dayOf(s, new Date());
  const inTeams = s.entries.filter((e) => e.status === "REGISTERED");
  const waiting = s.entries.filter((e) => e.status === "WAITING");
  const nameOf = (id: number) => s.entries.find((e) => e.team_id === id)?.team_name ?? "";
  const upcoming = day != null && day.phase !== "closed" && !s.tournament.started_at;
  const plan = upcoming ? startSwitch(dayEntries(s), s.tournament.max_teams) : {inactive: [], admitted: []};
  return {
    here: inTeams.filter((e) => e.arrived_at && !e.excluded_at).length,
    not_confirmed: inTeams.filter((e) => !e.arrived_at && !e.excluded_at).length,
    waiting_here: waiting.filter((e) => e.arrived_at).length,
    waiting: waiting.length,
    will_be_inactive: plan.inactive.map(nameOf),
    will_come_in: plan.admitted.map(nameOf),
    active: inTeams.filter((e) => e.active && !e.excluded_at).length,
    excluded: inTeams.filter((e) => e.excluded_at).length,
  };
}
