import assert from "node:assert/strict";
import {test} from "node:test";
import {GoogleLinkFacts, googleLinkDecision} from "@/app/_lib/auth/googleLink";
import {PASSWORD_ACCOUNT, PASSWORD_ACCOUNT_CODE, loginErrorMessage} from "@/app/_interfaces/login";

// Which player a Google login opens (issue #59): the email on a row opened with a password was never confirmed, so
// Google is not linked to such a row unless its password was used in this browser first.

const facts = (over: Partial<GoogleLinkFacts> = {}): GoogleLinkFacts => ({
  linked: null,
  byEmail: null,
  sessionPlayerId: null,
  ...over,
});

test("a Google account that was linked before opens its own player", () => {
  assert.equal(googleLinkDecision(facts({linked: {active: true}})), "allow");
  // the email's row doesn't come into it, even when it has a password
  assert.equal(
    googleLinkDecision(facts({linked: {active: true}, byEmail: {id: 7, active: true, hasPassword: true}})),
    "allow",
  );
  assert.equal(googleLinkDecision(facts({linked: {active: false}})), "deactivated");
});

test("an email nobody has makes a new account", () => {
  assert.equal(googleLinkDecision(facts()), "allow");
});

test("a row without a password is linked by email, as before", () => {
  // made by an earlier Google login, by the seed or by an admin: no password to abuse
  assert.equal(googleLinkDecision(facts({byEmail: {id: 7, active: true, hasPassword: false}})), "allow");
  assert.equal(googleLinkDecision(facts({byEmail: {id: 7, active: false, hasPassword: false}})), "deactivated");
});

test("a password account's email is not caught by a Google login", () => {
  // whoever registered first with someone else's email would otherwise get their Google login
  assert.equal(googleLinkDecision(facts({byEmail: {id: 7, active: true, hasPassword: true}})), "password_account");
  // another player's password session is no proof either
  assert.equal(
    googleLinkDecision(facts({byEmail: {id: 7, active: true, hasPassword: true}, sessionPlayerId: 8})),
    "password_account",
  );
  // a deactivated account is still turned away as deactivated
  assert.equal(
    googleLinkDecision(facts({byEmail: {id: 7, active: false, hasPassword: true}, sessionPlayerId: 7})),
    "deactivated",
  );
});

test("the player who logged in with the password links Google to their own account", () => {
  assert.equal(
    googleLinkDecision(facts({byEmail: {id: 7, active: true, hasPassword: true}, sessionPlayerId: 7})),
    "allow",
  );
});

test("Prijava says what to do with an email that already has a password account", () => {
  assert.equal(loginErrorMessage(PASSWORD_ACCOUNT_CODE), PASSWORD_ACCOUNT);
});
