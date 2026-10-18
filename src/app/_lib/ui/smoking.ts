import {count, NOUN} from "./text";

// The copy of Novo kolo's Pušački stolovi card and the Pušački raspored (design 12g). Framework free so the counts
// can be unit tested.

// when none of the teams counted has a smoker
const NO_SMOKERS = "nijedna ekipa nema pušača";

// The card's line under its title: "Stolovi 1, 2 · 7 pušača u 6 ekipa", "Stol 3 · 1 pušač u 1 ekipi", and
// "Stolovi 1, 2 · nijedna ekipa nema pušača" when no team switched on has one
export function smokingSummary(on: boolean, tables: number[], smokers: number, smokingTeams: number): string {
  if (!on) return "Isključeno · svi stolovi su nepušački";
  if (!tables.length) return "Nije odabran nijedan stol";
  const who = smokingTeams ? `${count(smokers, NOUN.pušač)} u ${count(smokingTeams, NOUN.ekipaLoc)}` : NO_SMOKERS;
  return `${tables.length === 1 ? "Stol" : "Stolovi"} ${tables.join(", ")} · ${who}`;
}

// The plan's line under its title: "2 pušačka stola × 3 kola · 6 ekipa s pušačima"; before tonight's first round
// "Večeras još nema kola · 6 ekipa s pušačima", and when tonight's rounds have no smoking table "Večeras nema
// pušačkih stolova · 3 kola · 6 ekipa s pušačima"
export function planHeading(smokingTables: number, rounds: number, smokingTeams: number): string {
  const teams = smokingTeams ? `${count(smokingTeams, NOUN.ekipa)} s pušačima` : NO_SMOKERS;
  if (!rounds) return `Večeras još nema kola · ${teams}`;
  if (!smokingTables) return `Večeras nema pušačkih stolova · ${count(rounds, NOUN.kolo)} · ${teams}`;
  return `${count(smokingTables, NOUN.pušačkiStol)} × ${count(rounds, NOUN.kolo)} · ${teams}`;
}

// A team's smokers under its name in the plan: "1 pušač", "2 pušača", "bez pušača"
export const smokersLabel = (n: number): string => (n > 0 ? count(n, NOUN.pušač) : "bez pušača");

// A rotation dot: where the team sat in one of tonight's rounds (null: it had no table); round: what the round is
// called ("Kolo 3", "Skica A")
export const roundDotLabel = (round: string, smoking: boolean | null): string =>
  `${round}: ${smoking == null ? "nije za stolom" : smoking ? "pušački stol" : "običan stol"}`;

// "2,5": the fair share with a decimal comma
const decimal = (n: number) => String(n).replace(".", ",");

// The Udio cell's tooltip: "3 od 12 kola za pušačkim stolom; pravedan udio 2,5" ("od 1 kola", "od 5 kola": the
// genitive is "kola" for every number)
export const shareTitle = (smokingRounds: number, rounds: number, fairShare: number): string =>
  `${smokingRounds} od ${rounds} kola za pušačkim stolom; pravedan udio ${decimal(fairShare)}`;

// The Propušteno cell's tooltip: "2 večeri s pušačem, bez pušačkog stola"
export const missedTitle = (nights: number): string => `${count(nights, NOUN.večer)} s pušačem, bez pušačkog stola`;
