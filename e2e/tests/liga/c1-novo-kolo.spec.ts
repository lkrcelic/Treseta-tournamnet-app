// C1 · the admin starts tonight's league night on the phone: Večer lige → the league → Novo kolo → Tko igra večeras →
// Kreiraj → Skica kola → Odobri sva → Objavi → Dnevni poredak. League "E2E · Novo kolo" (no start time, so no Tu smo:
// every active team plays unless the admin switches it off). The `night` fixture empties tonight before and after.
import {expect, test} from "../../helpers/c1";
import {escape} from "../../helpers/scorepad";

test("the admin creates tonight's Kolo with Novo kolo, approves and publishes it, and Dnevni poredak shows it", async ({as, db, night, healthy}) => {
  const leagueId = night.league.id;
  const teams = await db.team.findMany({where: {leagueTeams: {some: {league_id: leagueId}}}, orderBy: {team_name: "asc"}});
  expect(teams).toHaveLength(8);
  // two teams sit tonight out, so six play at three tables
  const out = teams.slice(-2).map((t) => t.team_name);
  const playing = teams.slice(0, 6).map((t) => t.team_name);
  // publishing numbers the Kolo after the league's last published one
  const last = await db.round.aggregate({_max: {round_number: true}, where: {leagueRounds: {some: {league_id: leagueId}}, status: "PUBLISHED"}});
  const kolo = (last._max.round_number ?? 0) + 1;

  const page = await as("admin");
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Večer lige"})).toBeVisible();
  await page.getByRole("button", {name: /^Liga: .*\. Promijeni ligu$/}).click();
  await page.getByRole("dialog", {name: "Odaberi ligu"}).getByRole("option", {name: new RegExp(`^${escape(night.league.name)} `)}).click();
  await expect(page.getByRole("button", {name: `Liga: ${night.league.name}. Promijeni ligu`})).toBeVisible();
  const tonight = page.getByRole("region", {name: "Večeras"});
  await expect(tonight).toContainText("Kola još nisu kreirana");
  await tonight.getByRole("button", {name: "Novo kolo"}).click();

  // Novo kolo: one Kolo tonight, and Tko igra večeras without the two teams
  await expect(page.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  const rounds = page.getByRole("radiogroup", {name: "Broj kola večeras"});
  await rounds.getByRole("radio", {name: "1", exact: true}).click();
  await expect(rounds.getByRole("radio", {name: "1", exact: true})).toBeChecked();
  const who = page.getByRole("region", {name: "Tko igra večeras"});
  await expect(who.getByRole("status")).toHaveText(/^8 \/ 8\s*ekipa igra večeras$/);
  await who.getByRole("button", {name: "Promijeni"}).click();
  const sheet = page.getByRole("dialog", {name: "Tko igra večeras?"});
  for (const name of out) {
    const team = sheet.getByRole("switch", {name, exact: true});
    await expect(team).toBeChecked();
    await team.click();
    await expect(team).not.toBeChecked();
  }
  await sheet.getByRole("button", {name: "Gotovo"}).click();
  await expect(sheet).toBeHidden();
  await expect(who.getByRole("status")).toHaveText(/^6 \/ 8\s*ekipa igra večeras$/);
  await expect(who.getByRole("list", {name: "Ekipe koje ne igraju"}).getByRole("listitem")).toHaveText(out.map((n) => new RegExp(`^${escape(n)}`)));
  await page.getByRole("button", {name: "Kreiraj 1 kolo · 3 stola"}).click();

  // Skica kola: Skica A, three tables, each playing team once
  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  const draftList = page.getByRole("list", {name: "Skica A, stolovi"}).getByRole("listitem");
  await expect(draftList).toHaveCount(3);
  const tonightTables = () =>
    db.round.findMany({
      where: {leagueRounds: {some: {league_id: leagueId}}, round_date: new Date(night.night)},
      orderBy: {table_number: "asc"},
      include: {team1: true, team2: true},
    });
  const drafts = await tonightTables();
  expect(drafts.map((r) => r.status)).toEqual(["DRAFT", "DRAFT", "DRAFT"]);
  expect(drafts.flatMap((r) => [r.team1.team_name, r.team2.team_name]).sort()).toEqual([...playing].sort());
  await expect(draftList).toHaveText(drafts.map((r) => new RegExp(`^${r.table_number}\\s*${escape(r.team1.team_name)}\\s*vs\\s*${escape(r.team2.team_name)}$`)));

  await page.getByRole("button", {name: "Odobri sva"}).click();
  await expect(page.getByRole("button", {name: "Skica A: odobreno. Poništi odobrenje"})).toBeVisible();
  await page.getByRole("button", {name: "Objavi odobrena kola · 1/1"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();
  await expect(page.getByRole("button", {name: `Kolo ${kolo}, objavljeno`})).toBeVisible();

  // published as Kolo <next>, the same tables
  const published = await tonightTables();
  expect(published.map((r) => [r.status, r.round_number, r.published_at != null])).toEqual(published.map(() => ["PUBLISHED", kolo, true]));
  expect(published.map((r) => [r.team1_id, r.team2_id])).toEqual(drafts.map((r) => [r.team1_id, r.team2_id]));

  // Dnevni poredak: tonight's teams in Tablica okupljanja, and the Kolo with its three tables, none started
  await page.getByRole("button", {name: "Otvori Dnevni poredak"}).click();
  await expect(page).toHaveURL(new RegExp(`/league/${leagueId}/daily-standings`));
  const gathering = page.getByRole("tabpanel", {name: "Tablica okupljanja"}).getByRole("listitem");
  await expect(gathering).toHaveCount(6);
  for (const name of playing) await expect(gathering.filter({has: page.getByRole("link", {name, exact: true})})).toHaveCount(1);
  await page.getByRole("tab", {name: `Kolo ${kolo}`}).click();
  const tables = page.getByRole("tabpanel", {name: `Kolo ${kolo}`}).getByRole("link", {name: /^Stol \d+: /});
  await expect(tables).toHaveCount(3);
  for (const [i, r] of published.entries()) {
    await expect(tables.nth(i)).toHaveAccessibleName(
      new RegExp(`^Stol ${r.table_number}: ${escape(r.team1.team_name)} 0, ${escape(r.team2.team_name)} 0, nije počelo\\. Otvori stol$`),
    );
  }
  await healthy(page);
});
