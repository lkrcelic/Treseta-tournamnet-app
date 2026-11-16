// C3 · the admin's repairs of a table the tournament day closed without play, on the phone: Uredi ishod (a skipped
// table given to a team) and Vrati stol (a no-show back in play). The world's live tournament (tournaments.live) shows
// both buttons on its Kolo 2; the changes are made on a tournament of the test's own (removed afterwards), whose Kolo 1
// has a no-show and a skipped table.
// Expected values (BELA_SYNC.md · Turniri: Vrati stol 3ad6bb93, Uredi ishod 5183b955): Uredi ishod gives the team picked
// every match 5 : 0 as a no-show does, the other team is out, and Kolo 1's bans follow the result (the winner's is
// lifted, the loser keeps its own); Vrati stol opens the table again as if "Da, tu su" had been answered by the admin,
// the no-show's matches are gone, the team it put out is back and its Kolo 1 ban lifted.
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";
import type {Locator, Page} from "@playwright/test";
import {closeSignUps, expect, freeTeams, koloTables, publishedAgo, publishNextKolo, syncClock, test} from "../../helpers/c3";
import {escape} from "../../helpers/scorepad";

// The rows of Kolo 2's Statusi stolova on tournaments.live, on the admin's phone
async function liveKolo2(as: (who: string) => Promise<Page>, id: number) {
  const page = await as("admin");
  await page.goto(`/turniri/${id}/upravljanje?view=kola&kolo=2`);
  await expect(page.getByRole("heading", {name: "Kolo 2", level: 1})).toBeVisible();
  const rows = page.getByRole("region", {name: "Statusi stolova"}).getByRole("listitem");
  const kind = (label: string) => rows.filter({has: page.getByRole("link", {name: new RegExp(`^Stol \\d+ ${label} `)})});
  return {page, rows, kind};
}

const repairButtons = async (row: Locator) => {
  await expect(row.getByRole("button", {name: /^Uredi ishod Stola \d+$/})).toBeVisible();
  await expect(row.getByRole("button", {name: /^Vrati Stol \d+ u igru$/})).toBeVisible();
};

test("the live tournament's Kolo 2 offers Uredi ishod and Vrati stol on the table the admin gave a team and on every table closed without play", async ({as, world, healthy}) => {
  const {page, kind} = await liveKolo2(as, world.tournaments.live.id);
  const given = kind("Dodijeljena pobjeda");
  await expect(given).toHaveCount(1);
  await expect(given.getByRole("link")).toContainText("Odluka admina: pobjeđuju");
  await expect(given.getByRole("link")).toContainText(`${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji`);
  await repairButtons(given);
  const closed = kind("(Preskočen|Nedolazak)");
  await expect(closed.first()).toBeVisible();
  for (const row of await closed.all()) await repairButtons(row);
  await healthy(page);
});

test("the live tournament's Kolo 2 has the no-show its manifest names (\"Kolo 2 nedolazak\"), with Uredi ishod and Vrati stol", async ({as, world}) => {
  const {kind} = await liveKolo2(as, world.tournaments.live.id);
  const noShow = kind("Nedolazak");
  await expect(noShow).toHaveCount(1);
  await expect(noShow.getByRole("link")).toContainText(`${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji`);
  await repairButtons(noShow);
});

test("Uredi ishod gives a skipped table to a team (5 : 0, the other out, the bans follow) and Vrati stol brings a no-show back in play", async ({as, api, db, own, healthy}) => {
  test.setTimeout(120_000);
  const teams = await freeTeams(db, 6);
  const id = await own.make({name: "Popravci", matches_per_round: 2}, teams);
  await closeSignUps(own.admin, id);
  await publishNextKolo(own.admin, id);
  const [noShow, skipped, playing] = await koloTables(db, id, 1, teams);
  // Kolo 1: Ne, nisu došli at the first table, nobody at the second for 10 minutes
  await publishedAgo(db, [noShow.id], 7);
  const answer = await (await api(noShow.team1.phone)).post(`/api/rounds/${noShow.id}/attendance`, {data: {answer: "NO_SHOW"}});
  expect(await answer.json()).toEqual({outcome: "NO_SHOW"});
  await publishedAgo(db, [skipped.id], 11);
  await syncClock(own.admin, id);

  const entry = (teamId: number) => db.tournamentTeam.findUniqueOrThrow({where: {tournament_id_team_id: {tournament_id: id, team_id: teamId}}});
  const activeBans = async (teamId: number) => db.signupBan.count({where: {tournament_id: id, team_id: teamId, lifted_at: null}});
  expect((await db.round.findUniqueOrThrow({where: {id: skipped.id}})).attendance).toBe("SKIPPED");
  for (const team of [skipped.team1, skipped.team2!, noShow.team2!]) expect(await activeBans(team.id)).toBe(1);

  const page = await as("admin");
  await page.goto(`/turniri/${id}/upravljanje?view=kola&kolo=1`);
  const states = page.getByRole("region", {name: "Statusi stolova"});
  await expect(states.getByRole("link", {name: new RegExp(`^Stol ${skipped.table} Preskočen `)})).toBeVisible();

  // Uredi ishod of the skipped table: Pobjeda for its second team
  await states.getByRole("button", {name: `Uredi ishod Stola ${skipped.table}`}).click();
  const sheet = page.getByRole("dialog", {name: `Ishod Stola ${skipped.table}`});
  const choices = sheet.getByRole("radiogroup", {name: "Ishod stola"});
  await expect(choices.getByRole("radio", {name: "Nitko · preskočen"})).toBeChecked();
  const winner = skipped.team2!;
  const loser = skipped.team1;
  await choices.getByRole("radio", {name: `Pobjeda: ${winner.name}`}).click();
  await expect(choices.getByRole("radio", {name: `Pobjeda: ${winner.name}`})).toBeChecked();
  await expect(sheet).toContainText(`${winner.name} dobivaju svaku partiju stola 5 : 0 i ostaju u turniru bez zabrane prijava. ${loser.name} su isključeni i dobivaju zabranu prijava.`);
  await sheet.getByRole("button", {name: "Spremi ishod"}).click();
  await expect(sheet).toBeHidden();
  const given = states.getByRole("link", {name: new RegExp(`^Stol ${skipped.table} Dodijeljena pobjeda `)});
  await expect(given).toContainText(`Odluka admina: pobjeđuju ${winner.name} · ${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji · ${loser.name} isključeni`);
  await expect(page.getByRole("link", {name: new RegExp(`^Stol ${skipped.table}: ${escape(loser.name)} 0, ${escape(winner.name)} 2, završeno, razlika −10 : \\+10\\. Otvori stol$`)})).toBeVisible();

  const decided = await db.round.findUniqueOrThrow({where: {id: skipped.id}, include: {matches: {orderBy: {id: "asc"}}}});
  expect({
    attendance: decided.attendance,
    team: decided.attendance_team_id,
    wins: [decided.team1_wins, decided.team2_wins],
    matches: decided.matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side]),
  }).toEqual({attendance: "NO_SHOW", team: winner.id, wins: [0, 2], matches: [[NO_SHOW_SCORE[1], NO_SHOW_SCORE[0], 2], [NO_SHOW_SCORE[1], NO_SHOW_SCORE[0], 2]]});
  expect((await entry(winner.id)).excluded_at).toBeNull();
  expect((await entry(loser.id)).excluded_reason).toBe("NO_SHOW");
  expect(await activeBans(winner.id)).toBe(0);
  expect(await activeBans(loser.id)).toBe(1);

  // Vrati stol on the no-show: open again, as if Da, tu su; the 5 : 0 matches gone, the absent team back, its ban lifted
  await states.getByRole("button", {name: `Vrati Stol ${noShow.table} u igru`}).click();
  const back = page.getByRole("dialog", {name: `Vratiti Stol ${noShow.table} u igru?`});
  await expect(back).toContainText("Upisani rezultat nedolaska se briše.");
  await expect(back).toContainText("zabrana prijava im se ukida");
  await back.getByRole("button", {name: "Vrati stol"}).click();
  await expect(back).toBeHidden();
  await expect(states.getByRole("link", {name: new RegExp(`^Stol ${noShow.table} `)})).toHaveCount(0);
  // live again: its teams are at the table, as after "Da, tu su"
  await expect(page.getByRole("link", {name: `Stol ${noShow.table}: ${noShow.team1.name} 0, ${noShow.team2!.name} 0, uživo. Otvori stol`})).toBeVisible();
  await healthy(page);

  const reopened = await db.round.findUniqueOrThrow({where: {id: noShow.id}, include: {matches: true}});
  expect({open: reopened.open, attendance: reopened.attendance, wins: [reopened.team1_wins, reopened.team2_wins], matches: reopened.matches.length}).toEqual({
    open: true,
    attendance: "PRESENT",
    wins: [0, 0],
    matches: 0,
  });
  const returned = await entry(noShow.team2!.id);
  expect({excluded: returned.excluded_at, active: returned.active, status: returned.status}).toEqual({excluded: null, active: true, status: "REGISTERED"});
  expect(await activeBans(noShow.team2!.id)).toBe(0);
  // untouched: the third table still waits for its game
  expect((await db.round.findUniqueOrThrow({where: {id: playing.id}})).attendance).toBeNull();

  // the team that was out finds its table again, without a question (the admin answered for the table)
  const phone = await as(noShow.team2!.phone);
  const attention = phone.waitForResponse((r) => r.url().endsWith("/api/tournaments/attention"));
  await phone.goto("/");
  await expect(phone.getByRole("button", {name: new RegExp(`^STOL ${noShow.table} .*Započni igru$`)})).toBeVisible();
  // the app has asked whether a question is up for this table: none
  const asked = (await (await attention).json()) as {prompt: unknown};
  expect(asked.prompt).toBeNull();
  await expect(phone.getByRole("alertdialog")).toBeHidden();
});
