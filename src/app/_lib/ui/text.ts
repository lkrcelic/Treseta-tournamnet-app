// Small text helpers for the UI. Framework free so they can be unit tested.

// "Marko Marković" -> "MM", "mmarkovic" -> "MM", "ivan.b" -> "IB", "tomo_k" -> "TK"
export function initials(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  const words = clean.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

// Point difference with an explicit sign: +612, -36, 0
export function signed(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v > 0 ? `+${v}` : String(v);
}

// "dd.mm.yyyy" from an ISO date ("2026-02-17" or a full timestamp), without time zone surprises
export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const WEEKDAYS = ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"];

// "Utorak · 17.02.2026" for an ISO date
export function weekdayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${WEEKDAYS[day]} · ${displayDate(iso)}`;
}

// Case- and diacritic-insensitive "contains" for search boxes (č, ć, đ, š, ž)
export function matchesQuery(text: string, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(text).includes(q);
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

// Croatian plural: 1 stol, 2 stola, 5 stolova, 21 stol, 22 stola, 11–14 stolova
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// The three forms of a noun after a number: one (1, 21, 101), few (2–4, 22–24) and many (0, 5–20, 25…)
export type NounForms = readonly [one: string, few: string, many: string];

// Nouns (and short phrases that agree with the number) the app counts, for count() and plural()
export const NOUN = {
  igrač: ["igrač", "igrača", "igrača"],
  ekipa: ["ekipa", "ekipe", "ekipa"],
  // after "u": "u 1 ekipi", "u 2 ekipe", "u 5 ekipa"
  ekipaLoc: ["ekipi", "ekipe", "ekipa"],
  kolo: ["kolo", "kola", "kola"],
  večer: ["večer", "večeri", "večeri"],
  bod: ["bod", "boda", "bodova"],
  oglas: ["oglas", "oglasa", "oglasa"],
  liga: ["liga", "lige", "liga"],
  stol: ["stol", "stola", "stolova"],
  pušačkiStol: ["pušački stol", "pušačka stola", "pušačkih stolova"],
  runda: ["runda", "runde", "rundi"],
  igra: ["igra", "igre", "igara"],
  meč: ["meč", "meča", "mečeva"],
  par: ["par", "para", "parova"],
  pušač: ["pušač", "pušača", "pušača"],
  pobjeda: ["pobjeda", "pobjede", "pobjeda"],
  odigranoKolo: ["odigrano kolo", "odigrana kola", "odigranih kola"],
  ekipaTraži: ["ekipa traži", "ekipe traže", "ekipa traži"],
  ekipaNeIgra: ["ekipa ne igra", "ekipe ne igraju", "ekipa ne igra"],
  neaktivna: ["neaktivna", "neaktivne", "neaktivnih"],
  isključena: ["isključena", "isključene", "isključenih"],
  znak: ["znak", "znaka", "znakova"],
} as const satisfies Record<string, NounForms>;

// A number with its noun in the right form: count(2, NOUN.ekipa) -> "2 ekipe", count(5, NOUN.igrač) -> "5 igrača"
export function count(n: number, forms: NounForms): string {
  return `${n} ${plural(n, ...forms)}`;
}

// The label of a list's "load more" button: loadMoreLabel(7, NOUN.ekipa) -> "Učitaj još · još 7 ekipa"
export function loadMoreLabel(left: number, noun: NounForms): string {
  return `Učitaj još · još ${count(left, noun)}`;
}
