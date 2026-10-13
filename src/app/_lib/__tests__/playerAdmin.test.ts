import assert from "node:assert/strict";
import {test} from "node:test";
import type {PlayerView} from "../../_interfaces/player";
import {PHONE_ERROR} from "../phone";
import {draftChanges, draftErrors, firstErrorField, hasChanges, PlayerDraft, playerDraft} from "../ui/playerAdmin";

// "Uredi osobne podatke" (admin): the form, what Spremi sends and what it refuses before sending

const marko: PlayerView = {
  id: 7,
  first_name: "Marko",
  last_name: "Marković",
  name: "Marko Marković",
  active: true,
  username: "mmarkovic",
  email: "mmarkovic@gmail.com",
  phone: "+385 93 958 3406",
  birth_date: "1964-07-23",
  smoker: true,
  is_admin: false,
};

const form = playerDraft(marko);
const edit = (change: Partial<PlayerDraft>): PlayerDraft => ({...form, ...change});

test("the form opens with the player's details; missing ones are empty", () => {
  assert.deepEqual(form, {
    first_name: "Marko",
    last_name: "Marković",
    username: "mmarkovic",
    email: "mmarkovic@gmail.com",
    phone: "+385 93 958 3406",
    birth_date: "1964-07-23",
    smoker: true,
    is_admin: false,
  });
  const bare = playerDraft({id: 8, first_name: "Ana", last_name: "", name: "Ana", active: false, phone: null, birth_date: null});
  assert.deepEqual(bare, {first_name: "Ana", last_name: "", username: "", email: "", phone: "", birth_date: "", smoker: false, is_admin: false});
});

test("Spremi sends only what changed", () => {
  assert.deepEqual(draftChanges(form, form), {});
  assert.equal(hasChanges(draftChanges(form, form)), false);
  assert.deepEqual(draftChanges(form, edit({first_name: "Ante"})), {first_name: "Ante"});
  assert.deepEqual(draftChanges(form, edit({smoker: false, is_admin: true})), {smoker: false, is_admin: true});
  assert.deepEqual(draftChanges(form, edit({email: "marko@example.com", username: "marko.m"})), {username: "marko.m", email: "marko@example.com"});
});

test("spaces, the username's case and the phone's spelling are not a change", () => {
  assert.deepEqual(draftChanges(form, edit({first_name: " Marko ", email: "mmarkovic@gmail.com "})), {});
  assert.deepEqual(draftChanges(form, edit({username: " MMarkovic"})), {});
  assert.deepEqual(draftChanges(form, edit({phone: "093 958 3406"})), {});
  assert.deepEqual(draftChanges(form, edit({phone: "093 958 3407"})), {phone: "093 958 3407"});
});

test("an emptied phone or birth date removes it", () => {
  assert.deepEqual(draftChanges(form, edit({phone: "  "})), {phone: null});
  assert.deepEqual(draftChanges(form, edit({birth_date: ""})), {birth_date: null});
  const none = playerDraft({...marko, phone: null, birth_date: null});
  assert.deepEqual(draftChanges(none, {...none, phone: ""}), {});
  assert.deepEqual(draftChanges(none, {...none, birth_date: "1990-02-03"}), {birth_date: "1990-02-03"});
});

test("what is wrong is said under its field, in the server's words, before anything is sent", () => {
  assert.deepEqual(draftErrors({}), {});
  assert.deepEqual(draftErrors(draftChanges(form, edit({first_name: "  "}))), {first_name: "Ime je obavezno."});
  assert.deepEqual(draftErrors(draftChanges(form, edit({last_name: ""}))), {last_name: "Prezime je obavezno."});
  assert.deepEqual(draftErrors(draftChanges(form, edit({username: "mm"}))), {username: "Najmanje 3 znaka."});
  assert.deepEqual(draftErrors(draftChanges(form, edit({email: "marko@"}))), {email: "Neispravan email."});
  assert.deepEqual(draftErrors(draftChanges(form, edit({phone: "12"}))), {phone: PHONE_ERROR});
  assert.deepEqual(draftErrors(draftChanges(form, edit({birth_date: "1890-01-01"}))), {birth_date: "Neispravan datum rođenja."});
  assert.deepEqual(draftErrors(draftChanges(form, edit({first_name: "Ante", smoker: false}))), {});

  const many = draftErrors(draftChanges(form, edit({email: "x", first_name: ""})));
  assert.deepEqual(Object.keys(many).sort(), ["email", "first_name"]);
  assert.equal(firstErrorField(many), "first_name");
  assert.equal(firstErrorField({}), null);
});

test("a birth date that isn't whole is an error, not a removal", () => {
  // the date input gives "" for "dd.07.1964." (one part deleted): Spremi must not remove the stored date
  const partly = draftChanges(form, edit({birth_date: ""}));
  assert.deepEqual(partly, {birth_date: null});
  assert.deepEqual(draftErrors(partly, {birthDateIncomplete: true}), {birth_date: "Neispravan datum rođenja."});
  assert.equal(firstErrorField(draftErrors(partly, {birthDateIncomplete: true})), "birth_date");
  // ...also when nothing else changed (no date before, half a date typed)
  const none = playerDraft({...marko, birth_date: null});
  assert.deepEqual(draftErrors(draftChanges(none, none), {birthDateIncomplete: true}), {birth_date: "Neispravan datum rođenja."});
  // an input emptied of every part removes the date
  assert.deepEqual(draftErrors(partly, {birthDateIncomplete: false}), {});
});

test("an untouched field is never checked: an old username that breaks today's rules stays", () => {
  const old = playerDraft({...marko, username: "Marko Old"});
  assert.deepEqual(draftErrors(draftChanges(old, {...old, first_name: "Ante"})), {});
});
