import assert from "node:assert/strict";
import {afterEach, test} from "node:test";
import {Cookie} from "lucia";
import {hasLoginCookie, isOpenPath, isPlausibleGoogleToken, loginUrl} from "@/app/_lib/pageGate";
import {extractCookieWithoutSignature, signCookie, verifyCookie} from "@/app/_lib/service/auth/signCookie";

// The middleware's page gate and the signed password-login cookie behind it: the only thing between a visitor and the
// app's pages (a mistake either locks every player out on a league night or opens the admin's pages)

const env = process.env as Record<string, string | undefined>;
const originalKey = env.SECRET_KEY;
const originalNodeEnv = env.NODE_ENV;
afterEach(() => {
  env.SECRET_KEY = originalKey;
  env.NODE_ENV = originalNodeEnv;
});

function signed(value = "abc123sessionid", attributes: Record<string, unknown> = {maxAge: 2592000, path: "/"}): string {
  const cookie = new Cookie("auth_session", value, attributes);
  signCookie(cookie);
  return cookie.value;
}

test("a signed cookie verifies and gives back the session", async () => {
  env.SECRET_KEY = "test-key";
  const value = signed();
  const cookie = await verifyCookie({value});
  assert.equal(cookie?.value, "abc123sessionid");
  assert.equal(extractCookieWithoutSignature({name: "auth_session", value}).value, "abc123sessionid");
});

test("a changed session, a changed or missing signature or another key is refused", async () => {
  env.SECRET_KEY = "test-key";
  const value = signed();
  const dot = value.lastIndexOf(".");
  const data = value.slice(0, dot);
  const signature = value.slice(dot + 1);

  assert.equal(await verifyCookie({value: data.replace("abc123sessionid", "someoneelse") + "." + signature}), null);
  assert.equal(await verifyCookie({value: data + "." + signature.replace(/.$/, (c) => (c === "0" ? "1" : "0"))}), null);
  assert.equal(await verifyCookie({value: data + "."}), null);
  assert.equal(await verifyCookie({value: data}), null);
  assert.equal(await verifyCookie({value: ""}), null);
  assert.equal(await verifyCookie({value: "x"}), null);
  assert.equal(await verifyCookie(null), null);

  env.SECRET_KEY = "another-key";
  assert.equal(await verifyCookie({value}), null);
});

test("a cookie whose data has dots (an expiry date) still verifies", async () => {
  env.SECRET_KEY = "test-key";
  const value = signed("abc123sessionid", {path: "/", expires: new Date("2026-12-13T10:00:00.123Z"), domain: "bela.example.hr"});
  assert.equal((await verifyCookie({value}))?.value, "abc123sessionid");
  assert.equal(extractCookieWithoutSignature({name: "auth_session", value}).value, "abc123sessionid");
});

test("without SECRET_KEY production refuses to sign or verify", async () => {
  delete env.SECRET_KEY;
  env.NODE_ENV = "production";
  assert.throws(() => signed(), /SECRET_KEY/);
  await assert.rejects(() => verifyCookie({value: "{}.abcd"}), /SECRET_KEY/);
});

test("the open paths need no login, every other page does", () => {
  for (const path of [
    "/login",
    "/signup",
    "/league/2/standings",
    "/league/current/standings",
    "/api/auth/session",
    "/api/rounds/open",
    "/burza",
    "/burza/12",
    "/turniri",
    "/turniri/zavrseni",
    "/turniri/7",
    "/turniri/7/poredak",
    "/turniri/7/ekipe",
    "/_next/static/chunks/main.js",
    "/manifest.webmanifest",
    "/static/icon.png",
    "/logo.svg",
    "/sponsors/kafic.webp",
  ]) {
    assert.equal(isOpenPath(path), true, path);
  }
  for (const path of [
    "/",
    "/league/2/manage",
    "/league/2/daily-standings",
    "/admin",
    "/ratings",
    "/raspored",
    "/profile",
    "/burza/moji",
    "/burza/novi/zamjena",
    "/turniri/novi",
    "/turniri/7/upravljanje",
    "/turniri/7/stol/12",
  ]) {
    assert.equal(isOpenPath(path), false, path);
  }
});

test("a page needs a signed password cookie or a Google session token", async () => {
  env.SECRET_KEY = "test-key";
  assert.equal(await hasLoginCookie({}), false);
  assert.equal(await hasLoginCookie({password: signed()}), true);
  assert.equal(await hasLoginCookie({password: '{"name":"auth_session","value":"abc"}.deadbeef'}), false);
  assert.equal(await hasLoginCookie({password: "x"}), false);

  assert.equal(await hasLoginCookie({google: "3f1c2a9e-8b7d-4c6e-9a1f-0b2c3d4e5f60"}), true);
  for (const junk of ["", "x", "1", "short-token", "a b c d e f g h i j k l m n o", "<script>alert(1)</script>xxxxxxxx", "a".repeat(300)]) {
    assert.equal(await hasLoginCookie({google: junk}), false, junk);
    assert.equal(isPlausibleGoogleToken(junk), false, junk);
  }
  // a forged password cookie next to a junk Google one doesn't pass either
  assert.equal(await hasLoginCookie({password: "x.y", google: "x"}), false);
});

test("Prijava comes back to a Burza form after logging in, and to Početna from any other page", () => {
  const url = loginUrl("https://bela.example.hr/burza/novi/zamjena?team=4");
  assert.equal(url.pathname, "/login");
  assert.equal(url.origin, "https://bela.example.hr");
  assert.equal(url.searchParams.get("next"), "/burza/novi/zamjena?team=4");
  assert.equal(loginUrl("https://bela.example.hr/ratings").searchParams.get("next"), null);
  assert.equal(loginUrl("https://bela.example.hr/league/2/manage").searchParams.get("next"), null);
});
