import assert from "node:assert/strict";
import {test} from "node:test";
import {AdminPlayerUpdateValidation, PlayerActiveValidation} from "../../_interfaces/player";

// "Uredi osobne podatke" → Spremi (PATCH /api/admin/players/[id]): what the server accepts and how it stores it

const parse = (body: unknown) => AdminPlayerUpdateValidation.safeParse(body);
const message = (body: unknown) => {
  const r = parse(body);
  return r.success ? null : r.error.issues[0].message;
};

test("only the fields that changed are sent, and at least one", () => {
  assert.equal(message({}), "Nema promjena za spremanje.");
  assert.deepEqual(parse({first_name: "  Ana "}).data, {first_name: "Ana"});
  assert.deepEqual(parse({smoker: false}).data, {smoker: false});
  assert.deepEqual(parse({is_admin: true}).data, {is_admin: true});
});

test("names, username and email are cleaned and checked, in Croatian", () => {
  assert.equal(message({first_name: "   "}), "Ime je obavezno.");
  assert.equal(message({last_name: ""}), "Prezime je obavezno.");
  assert.equal(message({last_name: "x".repeat(101)}), "Prezime je predugo.");
  assert.deepEqual(parse({username: " Marko.B "}).data, {username: "marko.b"});
  assert.equal(message({username: "ma"}), "Najmanje 3 znaka.");
  assert.equal(message({email: ""}), "Email je obavezan.");
  assert.equal(message({email: "marko@"}), "Neispravan email.");
  assert.deepEqual(parse({email: " marko@example.com "}).data, {email: "marko@example.com"});
});

test("the phone is stored with the country code, and empty or null removes it", () => {
  assert.deepEqual(parse({phone: "091 234 5678"}).data, {phone: "+385 91 234 5678"});
  assert.deepEqual(parse({phone: ""}).data, {phone: null});
  assert.deepEqual(parse({phone: null}).data, {phone: null});
  assert.equal(message({phone: "12"}), "Upiši cijeli broj, npr. 091\u00a0234\u00a05678.");
});

test("the birth date is a real past date, or null to remove it", () => {
  assert.deepEqual(parse({birth_date: "1964-07-23"}).data, {birth_date: "1964-07-23"});
  assert.deepEqual(parse({birth_date: null}).data, {birth_date: null});
  assert.equal(message({birth_date: "1990-02-31"}), "Neispravan datum rođenja.");
  assert.equal(message({birth_date: "2999-01-01"}), "Neispravan datum rođenja.");
  assert.equal(message({birth_date: "23. 07. 1964."}), "Neispravan datum.");
});

test("the account switch needs a yes or no", () => {
  assert.deepEqual(PlayerActiveValidation.parse({active: false}), {active: false});
  assert.equal(PlayerActiveValidation.safeParse({}).success, false);
  assert.equal(PlayerActiveValidation.safeParse({active: "no"}).success, false);
});
