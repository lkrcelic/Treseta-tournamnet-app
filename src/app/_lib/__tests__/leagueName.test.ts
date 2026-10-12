import assert from "node:assert/strict";
import {test} from "node:test";
import {leagueNameTaken} from "../../_interfaces/league";
import {anyCase, escapeLike} from "../helpers/query/anyCase";

const leagues = [
  {id: 1, name: "Pitanik Bela Liga Jesen 25/26"},
  {id: 2, name: "Proljetna liga 2027"},
];

test("a league name is taken when another league has it in any case", () => {
  assert.equal(leagueNameTaken(leagues, "proljetna LIGA 2027"), true);
  assert.equal(leagueNameTaken(leagues, "  Proljetna liga 2027 "), true);
  assert.equal(leagueNameTaken(leagues, "Proljetna liga 2028"), false);
  assert.equal(leagueNameTaken(leagues, ""), false);
  // renaming a league to its own name (in another case) is fine
  assert.equal(leagueNameTaken(leagues, "PROLJETNA LIGA 2027", 2), false);
  assert.equal(leagueNameTaken(leagues, "Proljetna liga 2027", 1), true);
});

test("the server's any-case name filter escapes the LIKE wildcards", () => {
  // "_" and "%" would match any character in Postgres ILIKE
  assert.equal(escapeLike("Pitanik Bela Liga Jesen 25_26"), "Pitanik Bela Liga Jesen 25\\_26");
  assert.equal(escapeLike("100% liga"), "100\\% liga");
  assert.equal(escapeLike("a\\b"), "a\\\\b");
  assert.equal(escapeLike("Lavovi"), "Lavovi");
  assert.deepEqual(anyCase("Liga_1"), {equals: "Liga\\_1", mode: "insensitive"});
});
