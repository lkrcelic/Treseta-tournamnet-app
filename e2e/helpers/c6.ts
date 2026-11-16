// C6's own setup: Prijava used the way a person uses it, the accounts Registracija makes (deleted afterwards), and the
// world's accounts put back as the seed made them (zakljucan's lock count, novi.igrac's onboarding answers).
import type {Page, Response} from "@playwright/test";
import {expect, test as base} from "./fixtures";

// What Prijava says (src/app/login/ui/LogInForm.tsx, _interfaces/login.ts). The form has its own words for a wrong
// password; /api/login's body says "Pogrešno korisničko ime ili lozinka." (WRONG_API).
export const WRONG_NOTE = "Korisničko ime ili lozinka su netočni.";
export const WRONG_API = "Pogrešno korisničko ime ili lozinka.";
export const LOCKED_NOTE = "Previše neuspjelih pokušaja. Pokušaj ponovno za nekoliko minuta.";
export const DEACTIVATED_NOTE = "Račun je deaktiviran. Javi se administratoru.";

// Treseta's name over Prijava and in the page title (src/app/_lib/brand.ts; Bela: "Bela Liga" under "Piatnik")
export const BRAND_NAME = "Trešeta Liga";

// a password no generated account has (they all share PASSWORD from fixtures.ts)
export const WRONG_PASSWORD = "nije-ta-lozinka";

// A username nobody has, for one run: "c6." and the time in base 36, at most 20 signs of a–z, 0–9 and dots
// (validation/username.ts)
export function uniqueUsername(): string {
  return `c6.${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// Opens Prijava (or a page that sends a guest there) ready to type in. The form is only there once the app runs (the
// layout renders pages after mount), so its heading means it is ready. Prijava's install sheet stays away: as() pages
// are the app opened from the home screen (fixtures.ts), where Treseta offers no install (Bela's Prijava has a sheet
// to dismiss here).
export async function openLogin(page: Page, path = "/login") {
  await page.goto(path);
  await expect(page.getByRole("heading", {name: "Prijava", exact: true})).toBeVisible();
}

// Types the login and the password into Prijava and taps Prijavi se. Returns /api/login's answer, so a test counts
// attempts by the server's answers: the note under the form reads the same after every wrong password.
export async function logIn(page: Page, login: string, password: string): Promise<Response> {
  const submit = page.getByRole("button", {name: "Prijavi se", exact: true});
  // after a refused try the button is busy until the answer is on screen
  await expect(submit).toBeEnabled();
  await page.getByLabel("Korisničko ime ili Email").fill(login);
  await page.getByLabel("Lozinka", {exact: true}).fill(password);
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/login" && r.request().method() === "POST");
  await submit.click();
  return answer;
}

// The note under Prijava's form (or above it, for a Google login), by its words
export const note = (page: Page, text: string) => page.getByRole("alert").filter({hasText: text});

// Who the server says is logged in on this page, asked the way the app asks (GET /api/auth/me from the page, so it
// carries the page's cookies and address): the username, or null for nobody
export async function whoIsLoggedIn(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const res = await fetch("/api/auth/me");
    const body = res.ok ? await res.json() : null;
    return (body?.user?.username as string | undefined) ?? null;
  });
}

// A login and email in other capitals than stored, as a phone keyboard or a hasty hand types them: "Bez.Ekipe",
// "Bez.Ekipe@E2e.Test"
export const capitalised = (login: string) => login.replace(/(^|[.@_])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());

type Signups = {
  // a username the test is about to sign up with (any case); its account is deleted after the test
  add: (username: string) => void;
};

type LoginCounts = {
  // a failed-login count in the database (LoginFailure: "player:<id>", "login:<name>" for a name nobody has) that
  // the test leaves behind; deleted after the test
  forget: (key: string) => void;
};

export const test = base.extend<{
  signups: Signups;
  loginCounts: LoginCounts;
  lockFree: {id: number; username: string; key: string};
  newcomer: {id: number; username: string};
}>({
  signups: async ({db}, use) => {
    const made: string[] = [];
    const started = new Date();
    await use({add: (username) => made.push(username.trim().toLowerCase())});
    const players = await db.player.findMany({where: {username: {in: made}}, select: {id: true}});
    const ids = players.map((p) => p.id);
    await db.loginFailure.deleteMany({where: {key: {in: ids.map((id) => `player:${id}`)}}});
    // their sessions go with them (LuciaSession cascades)
    await db.player.deleteMany({where: {id: {in: ids}}});
    // each sign-up also counted for its page's address (at most 20 an hour, countSignup); this section's tests run one
    // at a time, so the counts started since this test began are this test's
    await db.loginFailure.deleteMany({where: {key: {startsWith: "signup:"}, first_failure: {gte: started}}});
  },
  loginCounts: async ({db}, use) => {
    const keys: string[] = [];
    await use({forget: (key) => keys.push(key)});
    await db.loginFailure.deleteMany({where: {key: {in: keys}}});
  },
  // zakljucan (accounts.locked), with no failed logins counted in the database before and after the test. The other
  // count, 5 per address and account, lives in the server's memory; every as() page has an address of its own, so a
  // page locked by one test is never used again.
  lockFree: async ({db, world}, use) => {
    const {id, username} = world.accounts.locked;
    const key = `player:${id}`;
    await db.loginFailure.deleteMany({where: {key}});
    await use({id, username, key});
    await db.loginFailure.deleteMany({where: {key}});
  },
  // novi.igrac (accounts.onboarding) as the seed made it, before and after: no birth date, Pušiš li? not answered
  newcomer: async ({db, world}, use) => {
    const {id, username} = world.accounts.onboarding;
    const reset = () => db.player.update({where: {id}, data: {birth_date: null, smoker: false, smoker_answered: false}});
    await reset();
    await use({id, username});
    await reset();
  },
});

export {expect} from "./fixtures";
