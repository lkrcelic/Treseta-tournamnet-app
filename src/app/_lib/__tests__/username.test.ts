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

  assert.equal(usernameError(""), "Username is required.");
  assert.equal(usernameError("   "), "Username is required.");
  assert.equal(usernameError("ab"), "At least 3 characters.");
  assert.equal(usernameError("a".repeat(21)), "At most 20 characters.");
  assert.equal(usernameError("ivan-petrov"), "Only letters a–z, numbers, dot and underscore.");
  assert.equal(usernameError("đuro"), "Only letters a–z, numbers, dot and underscore.");
  assert.equal(usernameError("ivan p"), "Only letters a–z, numbers, dot and underscore.");
});

test("the profile update takes a birth date and/or a username, lowercased", () => {
  assert.deepEqual(PlayerProfileUpdate.parse({username: " Marko.B "}), {username: "marko.b"});
  assert.deepEqual(PlayerProfileUpdate.parse({birth_date: "1990-05-17"}), {birth_date: "1990-05-17"});
  assert.equal(PlayerProfileUpdate.safeParse({username: "ab"}).success, false);
  assert.equal(PlayerProfileUpdate.safeParse({username: "ivan-petrov"}).success, false);
  assert.equal(PlayerProfileUpdate.safeParse({}).success, false);
});
