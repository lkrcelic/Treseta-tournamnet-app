// C3 · Kolo 1 and Nedolazak za stol on the phone. Kolo 1 is made and published from the admin's phone on the world's
// "Turnir spreman za start" (tournaments.ready, put back afterwards); the no-show times run on a tournament of the
// test's own (removed afterwards), with time moved by shifting each table's published_at.
// Expected values (BELA_SYNC.md · Turniri, src/app/_lib/tournamentDay.ts, master 86e5154b): the question "Jesu li … za
// stolom?" comes 4 minutes after the Kolo went out and "Da, tu su" works at once; "Ne, nisu došli" from 6 minutes (the
// server refuses it earlier); a table with no game and no answer is skipped at 10 minutes, not scored, and both teams
// are out. A no-show is won 5 : 0 every match (NO_SHOW_SCORE, a bye's score) with Match.winner_side, the absent team is
// out, and in Kolo 1 it gets a month's sign-up ban (both teams of a skipped table too).
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";
import {closeSignUps, clock, expect, freeTeams, koloTables, monthAfter, plusMinutes, publishedAgo, publishNextKolo, test, tick, zagrebDay} from "../../helpers/c3";
import {escape} from "../../helpers/scorepad";

test.describe("Kolo 1", () => {
  // tournaments.ready as the seed left it: no Kolo, not started
  test.afterEach(async ({db, world}) => {
    const id = world.tournaments.ready.id;
    const ids = (await db.round.findMany({where: {tournamentRounds: {some: {tournament_id: id}}}, select: {id: true}})).map((r) => r.id);
    await db.ongoingMatch.deleteMany({where: {round_id: {in: ids}}});
    await db.match.deleteMany({where: {round_id: {in: ids}}});
    await db.round.deleteMany({where: {id: {in: ids}}});
    await db.tournament.update({where: {tournament_id: id}, data: {started_at: null, arrival_closed_at: null, registrations_open: false}});
  });

  test("the admin makes Kolo 1 of a tournament ready to start (Složi Kolo 1, Objavi kolo) and the players see their table", async ({as, db, world, healthy}) => {
    const {id, name} = world.tournaments.ready;
    const entries = await db.tournamentTeam.findMany({where: {tournament_id: id}, include: {team: true}});
    // six teams in, all here, sign-ups closed: three tables
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => e.status === "REGISTERED" && e.active && e.arrived_at != null)).toBe(true);

    const page = await as("admin");
    await page.goto(`/turniri/${id}/upravljanje`);
    await expect(page.getByRole("heading", {name, level: 1})).toBeVisible();
    await expect(page.getByRole("switch", {name: /^Prijave zatvorene 6 od 8 ekipa/})).not.toBeChecked();
    await page.getByRole("tab", {name: "Kola"}).click();
    const kola = page.getByRole("tabpanel", {name: "Kola"});
    await expect(kola.getByText("Prijave su zatvorene: Kolo 1 se slaže nasumično.")).toBeVisible();
    await kola.getByRole("button", {name: "Složi Kolo 1"}).click();

    // Skica kola: three tables, every team once, nothing out to the players yet
    await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
    const draft = page.getByRole("list", {name: "Skica Kola 1, stolovi"}).getByRole("listitem");
    await expect(draft).toHaveCount(3);
    const tables = () =>
      db.round.findMany({where: {tournamentRounds: {some: {tournament_id: id}}}, orderBy: {table_number: "asc"}, include: {team1: true, team2: true}});
    const drafted = await tables();
    expect(drafted.map((r) => [r.round_number, r.status])).toEqual([
      [1, "DRAFT"],
      [1, "DRAFT"],
      [1, "DRAFT"],
    ]);
    expect(drafted.flatMap((r) => [r.team1_id, r.team2_id]).sort()).toEqual(entries.map((e) => e.team_id).sort());
    await expect(draft).toHaveText(drafted.map((r) => new RegExp(`^${r.table_number}\\s*${escape(r.team1.team_name)}\\s*vs\\s*${escape(r.team2.team_name)}$`)));
    await expect(page.getByText("Igrači ne vide stolove dok ne objaviš kolo.")).toBeVisible();

    // Objavi kolo: Kolo 1 is out, the tournament has started, its tables not begun
    await page.getByRole("button", {name: "Objavi kolo"}).click();
    await expect(page.getByRole("heading", {name: "Kolo 1", level: 1})).toBeVisible();
    for (const r of drafted) {
      await expect(page.getByRole("link", {name: `Stol ${r.table_number}: ${r.team1.team_name} 0, ${r.team2.team_name} 0, nije počelo. Otvori stol`})).toBeVisible();
    }
    const published = await tables();
    expect(published.map((r) => [r.id, r.status, r.open, r.published_at != null, r.matches_per_round])).toEqual(drafted.map((r) => [r.id, "PUBLISHED", true, true, 1]));
    const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
    expect({started: t.started_at != null, signUps: t.registrations_open}).toEqual({started: true, signUps: false});
    await healthy(page);

    // a player of the first table finds it on Početna (their own team named first)
    const [first] = published;
    const player = await db.player.findFirstOrThrow({where: {active: true, birth_date: {not: null}, smoker_answered: true, teamPlayers: {some: {team_id: {in: [first.team1_id, first.team2_id]}}}}});
    const phone = await as(player.username);
    await phone.goto("/");
    await expect(
      phone.getByRole("button", {name: new RegExp(`^STOL ${first.table_number} (?=.*${escape(first.team1.team_name)})(?=.*${escape(first.team2.team_name)}).*Započni igru$`)}),
    ).toBeVisible();
  });
});

test("Nedolazak za stol: the question at 4 minutes with Da, tu su at once, Ne, nisu došli from 6 (5 : 0 every match, the absent team out and banned), a table nobody answered skipped at 10", async ({
  as,
  api,
  db,
  own,
  healthy,
}) => {
  test.setTimeout(120_000);
  const teams = await freeTeams(db, 6);
  const id = await own.make({name: "Nedolazak", matches_per_round: 2}, teams);
  await closeSignUps(own.admin, id);
  await publishNextKolo(own.admin, id);
  const [present, absent, skipped] = await koloTables(db, id, 1, teams);
  const publishedAt = async (roundId: number) => (await db.round.findUniqueOrThrow({where: {id: roundId}})).published_at!;

  // just out: no question, and the server takes no answer before the question is up
  const reporter = await as(absent.team1.phone);
  const attention = reporter.waitForResponse((r) => r.url().endsWith("/api/tournaments/attention"));
  await reporter.goto("/");
  await attention;
  const question = reporter.getByRole("alertdialog", {name: `Jesu li ${absent.team2!.name} za stolom?`});
  await expect(reporter.getByRole("button", {name: new RegExp(`^STOL ${absent.table} .*Započni igru$`)})).toBeVisible();
  await expect(question).toBeHidden();
  const reporterApi = await api(absent.team1.phone);
  const early = await reporterApi.post(`/api/rounds/${absent.id}/attendance`, {data: {answer: "PRESENT"}});
  expect(early.status()).toBe(400);
  expect(await early.json()).toEqual({error: `Odgovor je moguć od ${clock(plusMinutes(await publishedAt(absent.id), 4))}.`});

  // 4 minutes: the question covers the app; Ne, nisu došli is locked until 6 (and the server refuses it)
  await publishedAgo(db, [present.id, absent.id], 4);
  await reporter.reload();
  await expect(question).toBeVisible();
  await expect(question.getByText(`Kolo 1 · Stol ${absent.table}`)).toBeVisible();
  await expect(question.getByRole("button", {name: "Da, tu su · započni igru"})).toBeEnabled();
  await expect(question.getByRole("button", {name: "Ne, nisu došli"})).toBeDisabled();
  const unlock = clock(plusMinutes(await publishedAt(absent.id), 6));
  await expect(question.getByText(`„Ne, nisu došli” je moguće od ${unlock}. Pričekajte protivnika.`)).toBeVisible();
  const tooSoon = await reporterApi.post(`/api/rounds/${absent.id}/attendance`, {data: {answer: "NO_SHOW"}});
  expect(tooSoon.status()).toBe(400);
  expect(await tooSoon.json()).toEqual({error: `„Ne, nisu došli” je moguće od ${unlock}.`});
  expect((await db.round.findUniqueOrThrow({where: {id: absent.id}})).attendance).toBeNull();

  // at the other table Da, tu su works at 4 minutes and opens Tko igra
  const host = await as(present.team1.phone);
  await host.goto("/");
  const hostQuestion = host.getByRole("alertdialog", {name: `Jesu li ${present.team2!.name} za stolom?`});
  await hostQuestion.getByRole("button", {name: "Da, tu su · započni igru"}).click();
  await expect(host.getByRole("heading", {name: "Tko igra ovu rundu?"})).toBeVisible();
  await expect(hostQuestion).toBeHidden();
  const here = await db.round.findUniqueOrThrow({where: {id: present.id}});
  expect({attendance: here.attendance, team: here.attendance_team_id, open: here.open}).toEqual({attendance: "PRESENT", team: present.team1.id, open: true});

  // 6 minutes: Ne, nisu došli, asked once more (Kolo 1: the absent team gets the ban), then the table is won 5 : 0
  await publishedAgo(db, [absent.id], 6);
  await reporter.reload();
  await question.getByRole("button", {name: "Ne, nisu došli"}).click();
  const confirm = reporter.getByRole("alertdialog", {name: `${absent.team2!.name} nisu došli?`});
  await expect(confirm.getByText(`${absent.team1.name} pobjeđuju`)).toBeVisible();
  await expect(confirm.getByText(`${absent.team2!.name} dobivaju i zabranu prijava na turnire na mjesec dana`, {exact: false})).toBeVisible();
  await confirm.getByRole("button", {name: "Potvrđujem, nisu došli"}).click();
  await expect(reporter).toHaveURL(new RegExp(`/turniri/${id}$`));
  const win = reporter.getByRole("region", {name: "Pobjeda bez igre"});
  await expect(win.getByRole("heading", {name: `Pobjeda bez igre · Stol ${absent.table}`})).toBeVisible();
  await expect(win.getByText(`${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]}`, {exact: true})).toHaveCount(2);
  await healthy(reporter);

  const noShow = await db.round.findUniqueOrThrow({where: {id: absent.id}, include: {matches: {orderBy: {id: "asc"}}}});
  expect({
    attendance: noShow.attendance,
    by: noShow.attendance_team_id,
    open: noShow.open,
    wins: [noShow.team1_wins, noShow.team2_wins],
    matches: noShow.matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side]),
  }).toEqual({attendance: "NO_SHOW", by: absent.team1.id, open: false, wins: [2, 0], matches: [[...NO_SHOW_SCORE, 1], [...NO_SHOW_SCORE, 1]]});
  const out = async (teamId: number) => {
    const e = await db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: teamId}}});
    return {reason: e.excluded_reason, kolo: e.excluded_kolo};
  };
  expect(await out(absent.team2!.id)).toEqual({reason: "NO_SHOW", kolo: 1});
  expect(await out(absent.team1.id)).toEqual({reason: null, kolo: null});
  const banUntil = monthAfter(zagrebDay());
  const bans = async (teamId: number) =>
    (await db.signupBan.findMany({where: {tournament_id: id, team_id: teamId, lifted_at: null}})).map((b) => b.until?.toISOString());
  expect(await bans(absent.team2!.id)).toEqual([banUntil.toISOString()]);
  expect(await bans(absent.team1.id)).toEqual([]);
  // the team that didn't come reads why it is out
  const gone = await as(absent.team2!.phone);
  await gone.goto(`/turniri/${id}`);
  const excluded = gone.getByRole("region", {name: "Isključeni ste iz turnira"});
  await expect(excluded.getByText(`${absent.team1.name} su u ${clock(noShow.attendance_at!)} prijavili da niste došli za Stol ${absent.table} u Kolu 1.`)).toBeVisible();
  await expect(excluded.getByText(`${absent.team1.name} su dobili ${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji.`)).toBeVisible();

  // 10 minutes without a game or an answer: the clock (/api/cron/tick) skips the table, unscored, both teams out and banned
  await publishedAgo(db, [skipped.id], 10);
  const cron = await api("guest");
  await expect
    .poll(
      async () => {
        await tick(cron);
        return (await db.round.findUniqueOrThrow({where: {id: skipped.id}})).attendance;
      },
      {timeout: 30_000, intervals: [1_000, 2_000, 5_000]},
    )
    .toBe("SKIPPED");
  const skip = await db.round.findUniqueOrThrow({where: {id: skipped.id}, include: {matches: true}});
  expect({open: skip.open, wins: [skip.team1_wins, skip.team2_wins], matches: skip.matches.length}).toEqual({open: false, wins: [0, 0], matches: 0});
  for (const team of [skipped.team1, skipped.team2!]) {
    expect(await out(team.id)).toEqual({reason: "SKIPPED", kolo: 1});
    expect(await bans(team.id)).toEqual([banUntil.toISOString()]);
  }
  // the skipped table's players are told once, then their page says they are out
  const late = await as(skipped.team1.phone);
  await late.goto(`/turniri/${id}`);
  const notice = late.getByRole("alertdialog", {name: "Meč je preskočen"});
  await expect(notice.getByText(`Kolo 1 · Stol ${skipped.table}`)).toBeVisible();
  await expect(notice.getByText(`${skipped.team1.name} i ${skipped.team2!.name} ispadaju iz turnira`)).toBeVisible();
  await notice.getByRole("button", {name: "Razumijem"}).click();
  await expect(notice).toBeHidden();
  await expect(late.getByRole("region", {name: "Isključeni ste iz turnira"})).toContainText(`Meč za Stolom ${skipped.table} u Kolu 1 nije započeo ni 10 minuta nakon početka kola`);

  // the admin's Kolo 1: the no-show and the skipped table under Statusi stolova
  const admin = await as("admin");
  await admin.goto(`/turniri/${id}/upravljanje?view=kola&kolo=1`);
  const states = admin.getByRole("region", {name: "Statusi stolova"});
  await expect(states.getByRole("link", {name: new RegExp(`^Stol ${absent.table} Nedolazak `)})).toContainText(`${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji`);
  await expect(states.getByRole("link", {name: new RegExp(`^Stol ${skipped.table} Preskočen `)})).toContainText("Meč se ne boduje, obje ekipe su isključene.");
  await expect(states.getByRole("link")).toHaveCount(2);
  await healthy(admin);
});
