import assert from "node:assert/strict";
import {test} from "node:test";
import {missedTitle, planHeading, roundDotLabel, shareTitle, smokersLabel, smokingSummary} from "../ui/smoking";

test("Pušački stolovi card line: off, none picked, no smokers, and counts that agree after 'u'", () => {
  assert.equal(smokingSummary(false, [1, 2], 7, 6), "Isključeno · svi stolovi su nepušački");
  assert.equal(smokingSummary(true, [], 7, 6), "Nije odabran nijedan stol");
  assert.equal(smokingSummary(true, [1, 2], 7, 6), "Stolovi 1, 2 · 7 pušača u 6 ekipa");
  assert.equal(smokingSummary(true, [3], 1, 1), "Stol 3 · 1 pušač u 1 ekipi");
  assert.equal(smokingSummary(true, [1, 2, 4], 3, 2), "Stolovi 1, 2, 4 · 3 pušača u 2 ekipe");
  assert.equal(smokingSummary(true, [1], 0, 0), "Stol 1 · nijedna ekipa nema pušača");
  assert.equal(smokingSummary(true, [1, 2], 0, 0), "Stolovi 1, 2 · nijedna ekipa nema pušača");
  assert.equal(smokingSummary(true, [1], 21, 21), "Stol 1 · 21 pušač u 21 ekipi");
});

test("Pušački raspored heading, before and after tonight's rounds", () => {
  assert.equal(planHeading(2, 3, 6), "2 pušačka stola × 3 kola · 6 ekipa s pušačima");
  assert.equal(planHeading(1, 1, 1), "1 pušački stol × 1 kolo · 1 ekipa s pušačima");
  assert.equal(planHeading(5, 4, 2), "5 pušačkih stolova × 4 kola · 2 ekipe s pušačima");
  assert.equal(planHeading(2, 0, 6), "Večeras još nema kola · 6 ekipa s pušačima");
  assert.equal(planHeading(0, 0, 0), "Večeras još nema kola · nijedna ekipa nema pušača");
  assert.equal(planHeading(2, 3, 0), "2 pušačka stola × 3 kola · nijedna ekipa nema pušača");
});

test("Pušački raspored heading when tonight's rounds were made without smoking tables", () => {
  assert.equal(planHeading(0, 3, 6), "Večeras nema pušačkih stolova · 3 kola · 6 ekipa s pušačima");
  assert.equal(planHeading(0, 1, 1), "Večeras nema pušačkih stolova · 1 kolo · 1 ekipa s pušačima");
});

test("smokers under a team name", () => {
  assert.equal(smokersLabel(0), "bez pušača");
  assert.equal(smokersLabel(1), "1 pušač");
  assert.equal(smokersLabel(2), "2 pušača");
  assert.equal(smokersLabel(5), "5 pušača");
});

test("rotation dots, share and missed nights", () => {
  assert.equal(roundDotLabel(3, true), "Kolo 3: pušački stol");
  assert.equal(roundDotLabel(3, false), "Kolo 3: običan stol");
  assert.equal(roundDotLabel(3, null), "Kolo 3: nije za stolom");
  assert.equal(shareTitle(3, 12, 2.5), "3 od 12 kola za pušačkim stolom; pravedan udio 2,5");
  assert.equal(shareTitle(0, 1, 0), "0 od 1 kola za pušačkim stolom; pravedan udio 0");
  assert.equal(missedTitle(1), "1 večer s pušačem, bez pušačkog stola");
  assert.equal(missedTitle(2), "2 večeri s pušačem, bez pušačkog stola");
  assert.equal(missedTitle(0), "0 večeri s pušačem, bez pušačkog stola");
});
