// What every scenario gets: the database, its own random generator, the app's clock and the catalog it fills in.
import {deflateSync} from "node:zlib";
import {prisma} from "@/app/_lib/prisma";
import {leagueDate, leagueNight, leagueNightString} from "@/app/_lib/dates";
import {createRng, type Rng} from "./rng";

// The test password's argon2id hash, the same one prisma/seed.ts uses, so every generated account takes that
// password without hashing 400 times. The password itself is in e2e/env.e2e.
export const TEST_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$pDs5fiTYGTo0XSEt/3Cf7w$x8wFo37pR763HFqVMKupfveO0dBebHhLweI15eac8EI";

export const DAY_MS = 24 * 60 * 60 * 1000;

// Named objects the tests use instead of magic ids, written to seed-manifest.json at the end
export type Catalog = {
  accounts: Record<string, {id: number; username: string; role: string; teams: number[]}>;
  leagues: Record<string, {id: number; name: string; tonight?: string}>;
  teams: Record<string, {id: number; name: string}>;
  tournaments: Record<string, {id: number; name: string; state: string}>;
  // a table a test plays on: its round, the open match (if any) and who may log in to play it
  tables: Record<string, {roundId: number; matchId?: number; note: string; team1: string[]; team2: string[]}>;
  ads: Record<string, {id: number; kind: string; open: boolean}>;
  bans: Record<string, {id: number; note: string}>;
  sponsors: Record<string, {id: number; name: string}>;
  // Treseta's places (Lokacije), scenarios/places.ts
  places: Record<string, {id: number; name: string}>;
};

export type Ctx = {
  prisma: typeof prisma;
  rng: Rng;
  // the moment the world is built for; "tonight" and "today" follow the app's own rules (06:00 for league nights)
  now: Date;
  tonight: Date; // league night at UTC midnight, as Round.round_date stores it
  tonightString: string;
  today: Date; // calendar day at UTC midnight (tournament dates)
  catalog: Catalog;
  log: (line: string) => void;
};

export function createCtx(seed: number, now = new Date()): Ctx {
  return {
    prisma,
    rng: createRng(seed),
    now,
    tonight: leagueNight(now),
    tonightString: leagueNightString(now),
    today: leagueDate(now),
    catalog: {accounts: {}, leagues: {}, teams: {}, tournaments: {}, tables: {}, ads: {}, bans: {}, sponsors: {}, places: {}},
    log: (line) => console.log(line),
  };
}

// a day relative to a UTC-midnight date
export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}

export function isoDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

// A moment on a league night at a Zagreb wall-clock time ("19:30"); hours past midnight belong to the next day.
// Zagreb is UTC+1 in winter and UTC+2 in summer: the offset is taken from the app's own formatter.
export function nightMoment(night: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(night.getTime() + (h * 60 + m) * 60_000 - 60 * 60_000);
  const zagreb = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zagreb",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(guess);
  const [gh, gm] = zagreb.split(":").map(Number);
  const wantMinutes = (h % 24) * 60 + m;
  const diff = wantMinutes - (gh * 60 + gm);
  return new Date(guess.getTime() + diff * 60_000);
}

// A valid 512×512 PNG in one colour with a darker diagonal band: small, but a real image the browser can draw
export function makePng(rgb: [number, number, number], size = 512): Buffer {
  const row = 1 + size * 3;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < size; x++) {
      const band = Math.abs(x - y) < size / 8;
      const o = y * row + 1 + x * 3;
      raw[o] = band ? rgb[0] >> 1 : rgb[0];
      raw[o + 1] = band ? rgb[1] >> 1 : rgb[1];
      raw[o + 2] = band ? rgb[2] >> 1 : rgb[2];
    }
  }
  const crcTable = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, {level: 9})),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
