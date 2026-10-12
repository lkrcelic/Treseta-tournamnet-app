import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeUsername, usernameError} from "../validation/username";
import {PlayerProfileUpdate} from "../../_interfaces/player";

test("usernames are stored trimmed and lowercase", () => {
  assert.equal(normalizeUsername("  Marko.B "), "marko.b");
  assert.equal(normalizeUsername("ivan_2"), "ivan_2");
});

test("a new username needs 3 to 20 of a-z, numbers, dot and underscore", () => {
  assert.equal(usernameError("marko.b"), undefined);
  assert.equal(usernameError("Ivan_2"), undefined); // checked lowercase
  assert.equal(usernameError("abc"), undefined);
  assert.equal(usernameError("a".repeat(20)), undefined);

  assert.equal(usernameError(""), "Korisničko ime je obavezno.");
  assert.equal(usernameError("   "), "Korisničko ime je obavezno.");
  assert.equal(usernameError("ab"), "Najmanje 3 znaka.");
  assert.equal(usernameError("a".repeat(21)), "Najviše 20 znakova.");
  assert.equal(usernameError("ivan-petrov"), "Samo slova a–z, brojevi, točka i podvlaka.");
  assert.equal(usernameError("đuro"), "Samo slova a–z, brojevi, točka i podvlaka.");
  assert.equal(usernameError("ivan p"), "Samo slova a–z, brojevi, točka i podvlaka.");
});

test("the profile update takes a birth date and/or a username, lowercased", () => {
  assert.deepEqual(PlayerProfileUpdate.parse({username: " Marko.B "}), {username: "marko.b"});
  assert.deepEqual(PlayerProfileUpdate.parse({birth_date: "1990-05-17"}), {birth_date: "1990-05-17"});
  assert.equal(PlayerProfileUpdate.safeParse({username: "ab"}).success, false);
  assert.equal(PlayerProfileUpdate.safeParse({username: "ivan-petrov"}).success, false);
  assert.equal(PlayerProfileUpdate.safeParse({}).success, false);
});
