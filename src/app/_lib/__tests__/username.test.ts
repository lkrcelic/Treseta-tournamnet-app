import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeUsername, usernameError} from "../validation/username";
import {PlayerCreateValidation, PlayerProfileUpdate} from "../../_interfaces/player";
import {validateSignupField} from "../ui/signupValidation";

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

test("sign-up keeps the profile's rules: a real, past birth date and a valid username, lowercased", () => {
  const ok = {username: " Marko.B ", password: "tajna1", email: "m@x.hr", first_name: "Marko", last_name: "Marković", birth_date: "1990-05-17"};
  const player = PlayerCreateValidation.parse(ok);
  assert.equal(player.username, "marko.b");
  assert.equal(player.birth_date.toISOString().slice(0, 10), "1990-05-17");

  // 31 February used to be stored as 3 March, and a date in the future as it was
  for (const birth_date of ["2021-02-31", "2999-01-01", "1899-12-31"]) {
    const result = PlayerCreateValidation.safeParse({...ok, birth_date});
    assert.equal(result.success, false, birth_date);
    assert.equal(result.error?.issues[0].message, "Neispravan datum rođenja.");
  }
  for (const username of ["Marko B", "ivan-petrov", "ab", "a".repeat(21)]) {
    assert.equal(PlayerCreateValidation.safeParse({...ok, username}).success, false, username);
  }

  // the form says the same before it sends
  const form = {...ok, confirm: ok.password};
  assert.equal(validateSignupField("birth_date", {...form, birth_date: "2021-02-31"}), "Neispravan datum rođenja.");
  assert.equal(validateSignupField("birth_date", {...form, birth_date: "2999-01-01"}), "Neispravan datum rođenja.");
  assert.equal(validateSignupField("username", {...form, username: "Marko B"}), "Samo slova a–z, brojevi, točka i podvlaka.");
  assert.equal(validateSignupField("username", {...form, username: "Marko.B"}), undefined);
});
