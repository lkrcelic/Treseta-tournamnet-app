// Which card a player sees on top of Početna · Liga (LOCATIONS_PLAN.md, decisions 20–21; Claude Design 01 A). One
// rule for every league night, one place or two. Framework free so it can be unit tested.
//
// - table: a table to play (Započni igru) or being played (Nastavi igru)
// - end: Kraj večeri, after the team's table in the last Kolo of its place, or a bye in that Kolo
// - bye: Pauza, the team sits out a Kolo (odd number of teams) that isn't the last
// - next: Sljedeći stol, the team played its table and the next one isn't published yet
// - night: the night's card (Sljedeća večer or Večeras, with Tu smo); also "Tu ste" before the team's first table
// - none: Nema zakazane večeri, no table and no night to come

export type HomeCard = "table" | "end" | "bye" | "next" | "night" | "none";

// The team's evening so far, at its place; null when its league doesn't play tonight
export type TonightTeam = {
  // the night has started (the arrival window's "started"; until 06:00 the next day)
  started: boolean;
  // the team confirmed Tu smo and hasn't left
  here: boolean;
  // the team's latest closed table tonight, a bye included, and which of the place's Kola it was ("Kolo 2/3")
  lastTable: {kolo: [number, number]; bye: boolean} | null;
  // the place has published as many Kola as the league plays a night (rounds_per_night)
  lastKoloOut: boolean;
};

export function homeCard(input: {openTable: boolean; tonight: TonightTeam | null; nextNight: boolean}): HomeCard {
  const {openTable, tonight, nextNight} = input;
  if (openTable) return "table";
  if (tonight?.started && tonight.here && tonight.lastTable) {
    const [k, n] = tonight.lastTable.kolo;
    if (tonight.lastKoloOut && k === n) return "end";
    return tonight.lastTable.bye ? "bye" : "next";
  }
  if (tonight || nextNight) return "night";
  return "none";
}
