// The tournaments that have been played or are being played.
// - Finished ones (a week and three weeks ago) are history, written in bulk like the league nights: Kolo 1 drawn at
//   random, the rest Swiss by the tournament standings, a bye for an odd number, and in the bigger one a Kolo 1
//   no-show with its automatic one-month ban, exactly the rows the app leaves behind.
// - Today's are made through the app's services: one live (Kolo 1 played, Kolo 2 with a no-show, a skipped table the
//   admin gave to a team, a finished table and one being played), one in its arrival window, one ready for Kolo 1.
import type {Team} from "@prisma/client";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {answerAttendance, setTableOutcome, skipDueTables} from "@/app/_lib/service/tournament/attendance";
import {adminSetArrival, closeArrival} from "@/app/_lib/service/tournament/day";
import {makeKoloDraft, publishKolo} from "@/app/_lib/service/tournament/kola";
import {createTournament} from "@/app/_lib/service/tournament/tournaments";
import {addDays, isoDay, nightMoment, type Ctx} from "../context";
import {playLiveTable, usernames} from "../live";
import {BYE_MATCH_POINTS, type MatchEnd} from "@/app/_lib/game/scoring";
import {GAME_MINUTES_DEFAULT} from "@/app/_lib/gameTime";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";
import {edgeOf, lineups, playMatch, strengths, TableWriter} from "../play";
import {placeId} from "./places";
import {swissRound} from "./history";
import type {People} from "./people";
import {disjointTeams, enter, tournamentRequest, type TeamPool} from "./tournaments";

type FinishedSpec = {
  key: string;
  name: string;
  daysAgo: number;
  teams: number;
  kolos: number;
  matchesPerRound: 1 | 2;
  declarations: boolean;
  // Kraj partije (Treseta's own): "s ovim dosta" or "na prolaz"
  end: MatchEnd;
  noShow: boolean;
  by: number;
};

export async function playTournamentHistory(ctx: Ctx, people: People, pool: TeamPool, writer: TableWriter) {
  const specs: FinishedSpec[] = [
    {key: "finished", name: "Jesenski kup", daysAgo: 7, teams: 14, kolos: 5, matchesPerRound: 1, declarations: true, end: "S_OVIM_DOSTA", noShow: true, by: people.admin.id},
    {
      key: "finishedNoDeclarations",
      name: "Kup bez zvanja",
      daysAgo: 21,
      teams: 7,
      kolos: 3,
      matchesPerRound: 2,
      declarations: false,
      end: "NA_PROLAZ",
      noShow: false,
      by: people.organizer.id,
    },
  ];
  for (const spec of specs) await finishedTournament(ctx, people, pool, writer, spec);
}

async function finishedTournament(ctx: Ctx, people: People, pool: TeamPool, writer: TableWriter, spec: FinishedSpec) {
  const {prisma} = ctx;
  const rng = ctx.rng.fork(`tournament-${spec.key}`);
  const day = addDays(ctx.today, -spec.daysAgo);
  const start = nightMoment(day, "18:00");
  const teams = disjointTeams(ctx, pool, spec.teams, spec.key, new Set([people.playerTeam.team_id]));
  const t = await prisma.tournament.create({
    data: {
      ...tournamentFields(spec, day),
      started_at: start,
      arrival_closed_at: start,
      registrations_open: false,
      created_by: spec.by,
      created_at: addDays(day, -14),
    },
  });
  await prisma.tournamentPrize.createMany({
    data: [
      {tournament_id: t.tournament_id, place: 1, prize: "150 €", description: ""},
      {tournament_id: t.tournament_id, place: 2, prize: "Pršut", description: ""},
    ],
  });
  const absent = spec.noShow ? teams[teams.length - 1] : null;
  await prisma.tournamentTeam.createMany({
    data: teams.map((team, i) => ({
      tournament_id: t.tournament_id,
      team_id: team.team_id,
      registered_at: addDays(day, -10 + i * 0.3),
      registered_by: pool.rosters.get(team.team_id)![0],
      arrived_at: new Date(start.getTime() - rng.int(5, 30) * 60_000),
      arrived_by: pool.rosters.get(team.team_id)![0],
      ...(team === absent ? {excluded_at: new Date(start.getTime() + 6 * 60_000), excluded_kolo: 1, excluded_reason: "NO_SHOW" as const} : {}),
    })),
  });

  const strength = strengths(rng, teams.map((x) => x.team_id));
  const table = new Map(teams.map((x) => [x.team_id, {points: 0, diff: 0, met: new Set<number>()}]));
  let playing = teams.map((x) => x.team_id);
  for (let kolo = 1; kolo <= spec.kolos; kolo++) {
    const published = new Date(start.getTime() + (kolo - 1) * 40 * 60_000);
    const metTonight = new Set<string>();
    const order = kolo === 1 ? rng.shuffle(playing) : playing;
    const {pairs, bye} = swissRound(rng, order, kolo === 1 ? new Map(order.map((id) => [id, {points: 0, diff: 0, met: new Set<number>()}])) : table, metTonight);
    for (const [i, [a, b]] of Array.from(pairs.entries())) {
      const roundId = writer.nextRoundId();
      const noShow = kolo === 1 && absent != null && (a === absent.team_id || b === absent.team_id);
      const [t1, t2] = noShow && a === absent!.team_id ? [b, a] : [a, b];
      let wins1 = 0;
      let diff = 0;
      if (noShow) {
        const at = new Date(published.getTime() + 6 * 60_000);
        for (let m = 0; m < spec.matchesPerRound; m++) writer.addScoreOnly(roundId, day, NO_SHOW_SCORE[0], NO_SHOW_SCORE[1], at);
        wins1 = spec.matchesPerRound;
        diff = (NO_SHOW_SCORE[0] - NO_SHOW_SCORE[1]) * spec.matchesPerRound;
      } else {
        let clock = new Date(published.getTime() + 3 * 60_000);
        for (let m = 0; m < spec.matchesPerRound; m++) {
          const played = playMatch(rng, edgeOf(strength, t1, t2), {declarations: spec.declarations, end: spec.end});
          const end = new Date(clock.getTime() + rng.int(15, 30) * 60_000);
          writer.addMatch(roundId, day, played, clock, end);
          clock = end;
          wins1 += Number(played.winner === 1);
          diff += played.score1 - played.score2;
        }
        const [players1, players2] = lineups(rng, people.activeRosters.get(t1) ?? [], people.activeRosters.get(t2) ?? []);
        for (const [teamId, ids] of [[t1, players1], [t2, players2]] as const) {
          for (const playerId of ids) writer.roundPlayers.push({round_id: roundId, player_id: playerId, team_id: teamId});
        }
      }
      const respondent = pool.rosters.get(t1)![0];
      writer.rounds.push({
        id: roundId,
        round_number: kolo,
        round_date: day,
        team1_id: t1,
        team2_id: t2,
        team1_wins: wins1,
        team2_wins: spec.matchesPerRound - wins1,
        open: false,
        active: false,
        table_number: i + 1,
        status: "PUBLISHED",
        published_at: published,
        matches_per_round: spec.matchesPerRound,
        declarations: spec.declarations,
        match_end: spec.end,
        ...(noShow
          ? {attendance: "NO_SHOW" as const, attendance_team_id: t1, attendance_by: respondent, attendance_at: new Date(published.getTime() + 6 * 60_000)}
          : {attendance: "PRESENT" as const, attendance_team_id: t1, attendance_by: respondent, attendance_at: new Date(published.getTime() + 2 * 60_000)}),
      });
      writer.tournamentRounds.push({tournament_id: t.tournament_id, round_id: roundId});
      const points1 = wins1 * 2 > spec.matchesPerRound ? spec.matchesPerRound : wins1 * 2 === spec.matchesPerRound ? 1 : 0;
      const points2 = spec.matchesPerRound - wins1 > wins1 ? spec.matchesPerRound : wins1 * 2 === spec.matchesPerRound ? 1 : 0;
      table.get(t1)!.points += points1;
      table.get(t2)!.points += points2;
      table.get(t1)!.diff += diff;
      table.get(t2)!.diff -= diff;
      table.get(t1)!.met.add(t2);
      table.get(t2)!.met.add(t1);
    }
    if (bye !== null) {
      const roundId = writer.nextRoundId();
      writer.rounds.push({
        id: roundId,
        round_number: kolo,
        round_date: day,
        team1_id: bye,
        team2_id: BYE_TEAM_ID,
        team1_wins: spec.matchesPerRound,
        team2_wins: 0,
        open: false,
        active: false,
        table_number: pairs.length + 1,
        status: "PUBLISHED",
        published_at: published,
        matches_per_round: spec.matchesPerRound,
        declarations: spec.declarations,
        match_end: spec.end,
      });
      writer.tournamentRounds.push({tournament_id: t.tournament_id, round_id: roundId});
      for (let m = 0; m < spec.matchesPerRound; m++) writer.addScoreOnly(roundId, day, BYE_MATCH_POINTS, 0, null);
      table.get(bye)!.points += spec.matchesPerRound;
      table.get(bye)!.diff += BYE_MATCH_POINTS * spec.matchesPerRound;
    }
    if (kolo === 1 && absent) playing = playing.filter((id) => id !== absent.team_id);
  }

  // the automatic ban of the Kolo 1 no-show: a month from that day, for the team and, through it, its players
  if (absent) {
    const until = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()));
    const ban = await prisma.signupBan.create({
      data: {
        team_id: absent.team_id,
        until,
        reason: `Nedolazak u 1. kolu · ${spec.name}`,
        tournament_id: t.tournament_id,
        created_at: new Date(start.getTime() + 6 * 60_000),
      },
    });
    await prisma.signupBan.createMany({
      data: (pool.rosters.get(absent.team_id) ?? []).map((player_id) => ({
        player_id,
        via_ban_id: ban.id,
        until,
        reason: ban.reason,
        tournament_id: t.tournament_id,
        created_at: ban.created_at,
      })),
    });
    ctx.catalog.bans.autoNoShow = {id: ban.id, note: `${absent.team_name}: nedolazak u 1. kolu (${spec.name}), do ${isoDay(until)}`};
  }
  ctx.catalog.tournaments[spec.key] = {
    id: t.tournament_id,
    name: spec.name,
    state: `Završen prije ${spec.daysAgo} dana, ${spec.teams} ekipa, ${spec.kolos} kola, ${spec.matchesPerRound} partija po kolu${spec.declarations ? "" : ", bez zvanja"}${spec.end === "NA_PROLAZ" ? ", na prolaz" : ""}${absent ? ", nedolazak u 1. kolu" : ""}`,
  };
}

function tournamentFields(spec: FinishedSpec, day: Date) {
  return {
    tournament_name: spec.name,
    date: day,
    gathering_time: "17:30",
    start_time: "18:00",
    location_id: placeId("pitanik"),
    rounds: spec.kolos,
    matches_per_round: spec.matchesPerRound,
    declarations: spec.declarations,
    match_end: spec.end,
    max_teams: spec.teams + 2,
    entry_fee: 10,
    game_minutes: GAME_MINUTES_DEFAULT,
    auto_publish: true,
    organizer_phone: "+385 91 000 0001",
  };
}

// Zagreb wall-clock "HH:MM" of a moment, or null when it falls on another day than today
function zagrebTime(ctx: Ctx, moment: Date): string | null {
  if (leagueDateString(moment) !== isoDay(ctx.today)) return null;
  return new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(moment);
}

// busy: the teams playing a league tonight, kept out of today's tournaments so nobody has two open tables at once
export async function seedTodayTournaments(ctx: Ctx, people: People, pool: TeamPool, busy: Team[]) {
  const {prisma} = ctx;
  const rng = ctx.rng.fork("tournaments-today");
  const admin = people.admin.id;
  const today = isoDay(ctx.today);
  // a player plays in one of today's tournaments only: a team taken today blocks every team sharing a player with it
  const usedToday = new Set<number>();
  const reserve = (team: Team) => {
    const mine = pool.rosters.get(team.team_id) ?? [];
    for (const [id, ids] of Array.from(pool.rosters)) if (ids.some((p) => mine.includes(p))) usedToday.add(id);
  };
  const pick = (n: number, label: string) => {
    const teams = disjointTeams(ctx, pool, n, label, usedToday);
    teams.forEach(reserve);
    return teams;
  };
  reserve(people.playerTeam);
  busy.forEach(reserve);
  const adminTeam = people.teams.find((t) => t.team_name === "Adminovi asovi")!;
  reserve(adminTeam);

  // --- live: started an hour ago, Kolo 1 played, Kolo 2 in every table state
  const startedAt = zagrebTime(ctx, new Date(ctx.now.getTime() - 70 * 60_000));
  const live = await createTournament(
    tournamentRequest({
      name: "Subotnji turnir uživo",
      date: today,
      gathering_time: null,
      start_time: startedAt,
      max_teams: 12,
      rounds: 4,
      matches_per_round: 1,
      auto_publish: false,
    }),
    admin,
  );
  const liveTeams: Team[] = [adminTeam, ...pick(9, "live")];
  await enter(ctx, pool, live, liveTeams);
  for (const team of liveTeams.slice(0, startedAt ? 9 : 10)) await adminSetArrival(live, team.team_id, true);
  if (startedAt) await prisma.$transaction((tx) => closeArrival(tx, live, ctx.now));
  await makeKoloDraft(live);
  await publishKolo(live, 1);
  const kolo = async (n: number) =>
    prisma.round.findMany({where: {tournamentRounds: {some: {tournament_id: live}}, round_number: n}, orderBy: {table_number: "asc"}});
  const strength = strengths(rng, liveTeams.map((t) => t.team_id));
  const playTable = (r: {id: number; team1_id: number; team2_id: number}, plan: Parameters<typeof playLiveTable>[4]) =>
    playLiveTable(
      ctx,
      rng,
      {roundId: r.id, team1: r.team1_id, team2: r.team2_id, matchesPerRound: 1, declarations: true, edge: edgeOf(strength, r.team1_id, r.team2_id)},
      people.activeRosters,
      plan,
    );
  for (const r of (await kolo(1)).filter((r) => r.team2_id !== BYE_TEAM_ID)) await playTable(r, {finished: 1});
  await prisma.round.updateMany({
    where: {tournamentRounds: {some: {tournament_id: live}}, round_number: 1},
    data: {published_at: new Date(ctx.now.getTime() - 60 * 60_000)},
  });
  await makeKoloDraft(live);
  await publishKolo(live, 2);
  // Kolo 2 went out 12 minutes ago, so its no-show question has been answerable and the skip is due
  await prisma.round.updateMany({
    where: {tournamentRounds: {some: {tournament_id: live}}, round_number: 2},
    data: {published_at: new Date(ctx.now.getTime() - 12 * 60_000)},
  });
  const second = (await kolo(2)).filter((r) => r.team2_id !== BYE_TEAM_ID);
  const [noShow, skipped, finished, ...playingTables] = second;
  await playTable(finished, {finished: 1});
  for (const r of playingTables) {
    const table = await playTable(r, {finished: 0, handsInOpenMatch: rng.int(2, 5)});
    if (r.team1_id === liveTeams[0].team_id || r.team2_id === liveTeams[0].team_id) {
      ctx.catalog.tables.adminTeamLive = {
        roundId: r.id,
        matchId: table.openMatchId ?? undefined,
        note: "Turnir uživo, Kolo 2: ekipa drugog admina igra",
        team1: await usernames(ctx, people.rosters, r.team1_id),
        team2: await usernames(ctx, people.rosters, r.team2_id),
      };
    }
  }
  await answerAttendance(noShow.id, {id: pool.activeRosters.get(noShow.team1_id)![0], player_role: "PLAYER"}, "NO_SHOW");
  await skipDueTables(live, ctx.now);
  await setTableOutcome(live, skipped.id, "TEAM1", admin);
  ctx.catalog.tournaments.live = {id: live, name: "Subotnji turnir uživo", state: "Uživo: Kolo 1 odigrano; Kolo 2 nedolazak, dodijeljena pobjeda, odigran stol i stolovi u igri"};

  // --- arrival window open now: gathering 15 min ago, start in an hour; the player's team hasn't said Tu smo yet
  const gathering = zagrebTime(ctx, new Date(ctx.now.getTime() - 15 * 60_000));
  const startsAt = zagrebTime(ctx, new Date(ctx.now.getTime() + 60 * 60_000));
  const arrivalOpen = gathering != null && startsAt != null;
  const arrivalDate = arrivalOpen ? today : isoDay(addDays(ctx.today, 1));
  const arrival = await createTournament(
    tournamentRequest({
      name: "Večernji turnir",
      date: arrivalDate,
      gathering_time: arrivalOpen ? gathering : "17:30",
      start_time: arrivalOpen ? startsAt : "18:00",
      max_teams: 10,
    }),
    admin,
  );
  await enter(ctx, pool, arrival, [people.playerTeam]);
  const arrivalTeams = pick(7, "arrival");
  await enter(ctx, pool, arrival, arrivalTeams);
  for (const team of arrivalTeams.slice(0, 5)) await adminSetArrival(arrival, team.team_id, true);
  ctx.catalog.tournaments.arrival = {
    id: arrival,
    name: "Večernji turnir",
    state: arrivalOpen
      ? "Danas, Potvrda dolaska otvorena; igračeva ekipa prijavljena, nije potvrdila"
      : "Sutra (seed je bio kasno navečer), Potvrda dolaska još nije otvorena",
  };

  // --- ready: everyone here, sign-ups closed, nothing drafted; the admin's test makes and publishes Kolo 1
  const ready = await createTournament(
    tournamentRequest({name: "Turnir spreman za start", date: today, gathering_time: null, start_time: null, max_teams: 8, rounds: 3}),
    admin,
  );
  const readyTeams = pick(6, "ready");
  await enter(ctx, pool, ready, readyTeams);
  for (const team of readyTeams) await adminSetArrival(ready, team.team_id, true);
  await prisma.tournament.update({where: {tournament_id: ready}, data: {registrations_open: false}});
  ctx.catalog.tournaments.ready = {id: ready, name: "Turnir spreman za start", state: "Danas, svi stigli, prijave zatvorene, Kolo 1 nije napravljeno"};

  ctx.log("tournaments (today): live, arrival, ready");
}
