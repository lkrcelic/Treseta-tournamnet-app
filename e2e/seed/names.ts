// Made-up Croatian people and teams. None of them is a real player: the names are combined at random, so screenshots
// and traces of the generated world may go anywhere (GitHub issues, reports).
import type {Rng} from "./rng";

const MALE = [
  "Ivan", "Marko", "Luka", "Josip", "Ante", "Tomislav", "Stjepan", "Mario", "Nikola", "Dario", "Krešimir", "Željko",
  "Zoran", "Goran", "Dražen", "Mladen", "Mate", "Šime", "Duje", "Frane", "Jure", "Tihomir", "Branko", "Zvonimir",
  "Vedran", "Hrvoje", "Domagoj", "Matej", "Filip", "Karlo", "Bruno", "Petar", "Damir", "Davor", "Boris", "Igor",
  "Robert", "Saša", "Darko", "Đuro", "Božidar", "Ljubo", "Nediljko", "Slavko", "Vinko", "Čedomir", "Antun", "Lovro",
  "Roko", "Toni", "Dino", "Neven", "Siniša", "Ognjen", "Emil", "Jakov", "Šimun", "Mislav", "Viktor", "Kristijan",
] as const;

const FEMALE = [
  "Ana", "Marija", "Ivana", "Petra", "Lucija", "Kristina", "Martina", "Maja", "Nikolina", "Sanja", "Željka", "Mirjana",
  "Snježana", "Dubravka", "Đurđica", "Ljiljana", "Vesna", "Gordana", "Jelena", "Katarina", "Tea", "Lana", "Ema",
  "Iva", "Antonija", "Barbara", "Dora", "Klara", "Mia", "Nika", "Zrinka", "Božena", "Matea", "Paula", "Sara",
] as const;

const SURNAMES = [
  "Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Novak", "Kovačić", "Knežević", "Vuković", "Marković", "Petrović",
  "Matić", "Tomić", "Pavlović", "Kovač", "Božić", "Blažević", "Grgić", "Pavić", "Radić", "Perić", "Filipović",
  "Šarić", "Lovrić", "Vidović", "Perković", "Popović", "Bošnjak", "Jukić", "Barišić", "Mandić", "Klarić", "Ćosić",
  "Đurić", "Šimić", "Zorić", "Čović", "Mikulić", "Bašić", "Galić", "Rukavina", "Šolić", "Bilić", "Vrdoljak",
  "Žužul", "Ćurković", "Džaja", "Ljubičić", "Škaro", "Grubišić", "Šestan", "Matijević", "Bradarić", "Tadić",
  "Šegvić", "Mihaljević", "Brkljačić", "Dragičević", "Jelić", "Lučić", "Ožegović", "Prskalo", "Topić", "Čačić",
] as const;

const TEAM_FIRST = [
  "Imotske", "Dalmatinske", "Zagorske", "Slavonske", "Ličke", "Kvarnerske", "Purgerske", "Istarske", "Pitanikove",
  "Brze", "Lude", "Stare", "Mlade", "Tihe", "Glasne", "Sretne", "Gladne", "Žedne", "Divlje", "Pospane",
] as const;

const TEAM_SECOND = [
  "Šarulje", "Lisice", "Bakule", "Pipe", "Ćuke", "Štuke", "Ruke", "Dame", "Kocke", "Bele", "Karte", "Ase",
  "Fige", "Trefe", "Herčeve", "Žirovi", "Koze", "Kune", "Svrake", "Čaplje",
] as const;

const TEAM_STANDALONE = [
  "Špicom u stomak", "Mujo i Haso", "Dubec kartel", "Lavovi", "Barcelona", "Belot do zore", "Štiglja ili ništa",
  "Dva aduta", "Zvanje pedeset", "Kralj i baba", "Desetka na stol", "Bez zvanja", "Pao, ali ponosan",
  "Pikova dama", "Herc as", "Tref kraljevi", "Karo dečki", "Kibiceri", "Ćevap i luk", "Fritula", "Rakija&Kava",
  "Uskoci", "Sinjska alka", "Dinamo kartaši", "Hajdukovci", "Bili kartaši", "Purgeri", "Bodulski kartaši",
] as const;

// deliberately long, with every Croatian diacritic, so the phone layout is tested with the worst real case
export const LONG_TEAM_NAME = "Čudesni ćevapčići iz Đakova i Žitnjaka što šapću zvanja";

export type Person = {first_name: string; last_name: string; username: string; email: string};

function ascii(text: string): string {
  return text
    .toLowerCase()
    .replace(/č|ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/[^a-z0-9]/g, "");
}

export function makePeople(rng: Rng, count: number, taken: Set<string>): Person[] {
  const people: Person[] = [];
  while (people.length < count) {
    const female = rng.chance(0.2);
    const first = rng.pick(female ? FEMALE : MALE);
    const last = rng.pick(SURNAMES);
    let username = `${ascii(first)}.${ascii(last)}`;
    for (let n = 2; taken.has(username); n++) username = `${ascii(first)}.${ascii(last)}${n}`;
    taken.add(username);
    people.push({first_name: first, last_name: last, username, email: `${username}@e2e.test`});
  }
  return people;
}

export function makeTeamNames(rng: Rng, count: number, taken: Set<string>): string[] {
  const names: string[] = [];
  const standalone = rng.shuffle(TEAM_STANDALONE);
  while (names.length < count) {
    let name: string;
    if (standalone.length > 0 && rng.chance(0.25)) name = standalone.pop()!;
    else name = `${rng.pick(TEAM_FIRST)} ${rng.pick(TEAM_SECOND)}`;
    for (let n = 2; taken.has(name); n++) name = `${name.replace(/ \d+$/, "")} ${n}`;
    taken.add(name);
    names.push(name);
  }
  return names;
}
