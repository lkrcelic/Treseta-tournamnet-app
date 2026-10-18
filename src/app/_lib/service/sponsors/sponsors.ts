import {Prisma} from "@prisma/client";
import {
  LogoBackground,
  SPONSOR_NOT_FOUND,
  SponsorAdmin,
  SponsorCounts,
  SponsorCreate,
  SponsorEvent,
  SponsorPublic,
  SponsorUpdate,
  UNKNOWN_SPONSORS,
} from "@/app/_interfaces/sponsor";
import {leagueDate} from "@/app/_lib/dates";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {decodeLogo, LogoError, sponsorLogoPath} from "@/app/_lib/sponsors";

// Everything of a sponsor but the logo's bytes
const SPONSOR_FIELDS = {id: true, name: true, url: true, message: true, background: true, logo_width: true, logo_height: true, updated_at: true} as const;
type SponsorRow = Prisma.SponsorGetPayload<{select: typeof SPONSOR_FIELDS}>;

const LEAGUE_NOT_FOUND = "Liga ne postoji.";

function toPublic(s: SponsorRow): SponsorPublic {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    message: s.message,
    background: s.background as LogoBackground,
    logo: sponsorLogoPath(s.id, s.updated_at),
    logo_width: s.logo_width,
    logo_height: s.logo_height,
  };
}

// ---------- the admin's list (Sponzori) ----------

// Every sponsor, by name, with the leagues that show it and its counts in all and per league
export async function listSponsorsForAdmin(): Promise<SponsorAdmin[]> {
  const [sponsors, counts] = await Promise.all([
    prisma.sponsor.findMany({
      select: {...SPONSOR_FIELDS, leagues: {select: {league: {select: {league_id: true, league_name: true}}}, orderBy: {league: {league_name: "asc"}}}},
      orderBy: [{name: "asc"}, {id: "asc"}],
    }),
    prisma.sponsorDailyStat.groupBy({by: ["sponsor_id", "league_id"], _sum: {views: true, clicks: true}}),
  ]);
  const bySponsor = new Map<number, Record<number, SponsorCounts>>();
  for (const c of counts) {
    const perLeague = bySponsor.get(c.sponsor_id) ?? {};
    perLeague[c.league_id] = {views: c._sum.views ?? 0, clicks: c._sum.clicks ?? 0};
    bySponsor.set(c.sponsor_id, perLeague);
  }
  return sponsors.map((s) => {
    const league_counts = bySponsor.get(s.id) ?? {};
    const all = Object.values(league_counts);
    return {
      ...toPublic(s),
      leagues: s.leagues.map((l) => ({id: l.league.league_id, name: l.league.league_name})),
      views: all.reduce((n, c) => n + c.views, 0),
      clicks: all.reduce((n, c) => n + c.clicks, 0),
      league_counts,
    };
  });
}

async function adminSponsor(id: number): Promise<SponsorAdmin> {
  const found = (await listSponsorsForAdmin()).find((s) => s.id === id);
  if (!found) throw new NotFoundError(SPONSOR_NOT_FOUND);
  return found;
}

// (zod's types leave the fields optional without strict mode; the schema has made them required)
function logoFields(logo: NonNullable<SponsorUpdate["logo"]>) {
  const {bytes, type} = decodeLogo(logo.data!);
  return {logo: bytes, logo_type: type, logo_width: logo.width!, logo_height: logo.height!};
}

export async function createSponsor(input: SponsorCreate): Promise<SponsorAdmin> {
  if (!input.logo) throw new LogoError("Dodaj logo sponzora.");
  const created = await prisma.sponsor.create({
    data: {name: input.name, url: input.url || null, message: input.message ?? "", background: input.background ?? "none", ...logoFields(input.logo)},
    select: {id: true},
  });
  return adminSponsor(created.id);
}

// What is left out stays as it is; a change of logo, link or message is seen in every league at once
export async function updateSponsor(id: number, input: SponsorUpdate): Promise<SponsorAdmin> {
  const data: Prisma.SponsorUpdateManyMutationInput = {
    // the logo's new address (its version) even when only the background changed
    updated_at: new Date(),
    ...(input.name !== undefined && {name: input.name}),
    ...(input.url !== undefined && {url: input.url || null}),
    ...(input.message !== undefined && {message: input.message}),
    ...(input.background !== undefined && {background: input.background}),
    ...(input.logo && logoFields(input.logo)),
  };
  const {count} = await prisma.sponsor.updateMany({where: {id}, data});
  if (!count) throw new NotFoundError(SPONSOR_NOT_FOUND);
  return adminSponsor(id);
}

// Off the list, out of every league, and its counts go too
export async function deleteSponsor(id: number): Promise<boolean> {
  const {count} = await prisma.sponsor.deleteMany({where: {id}});
  return count > 0;
}

export async function getSponsorLogo(id: number): Promise<{logo: Buffer; type: string; updatedAt: Date} | null> {
  const s = await prisma.sponsor.findUnique({where: {id}, select: {logo: true, logo_type: true, updated_at: true}});
  return s && {logo: Buffer.from(s.logo), type: s.logo_type, updatedAt: s.updated_at};
}

// ---------- a league's sponsors ----------

// The sponsors a league shows, in their order (Početna, the live round)
export async function leagueSponsors(leagueId: number): Promise<SponsorPublic[]> {
  const rows = await prisma.leagueSponsor.findMany({
    where: {league_id: leagueId},
    select: {sponsor: {select: SPONSOR_FIELDS}},
    orderBy: [{position: "asc"}, {sponsor_id: "asc"}],
  });
  return rows.map((r) => toPublic(r.sponsor));
}

// The league's sponsors become exactly these, in this order: the ones left out leave the league (their counts stay,
// should they come back), new ones join where they are in the list
export async function setLeagueSponsors(leagueId: number, sponsorIds: number[]): Promise<SponsorPublic[]> {
  const league = await prisma.league.findUnique({where: {league_id: leagueId}, select: {league_id: true}});
  if (!league) throw new NotFoundError(LEAGUE_NOT_FOUND);
  if (sponsorIds.length) {
    const known = await prisma.sponsor.count({where: {id: {in: sponsorIds}}});
    if (known !== sponsorIds.length) throw new NotFoundError(UNKNOWN_SPONSORS);
  }
  await prisma.$transaction([
    prisma.leagueSponsor.deleteMany({where: {league_id: leagueId}}),
    prisma.leagueSponsor.createMany({data: sponsorIds.map((sponsor_id, position) => ({league_id: leagueId, sponsor_id, position}))}),
  ]);
  return leagueSponsors(leagueId);
}

// ---------- counts ----------

// One more view (or opening of the page) for each of these sponsors in the league today, league time. Sponsors the
// league doesn't show (any more) are left out, so a stale screen can't count for them.
export async function recordSponsorEvent({league_id, kind, sponsor_ids}: SponsorEvent): Promise<void> {
  const shown = await prisma.leagueSponsor.findMany({where: {league_id, sponsor_id: {in: sponsor_ids}}, select: {sponsor_id: true}});
  if (!shown.length) return;
  const ids = shown.map((s) => s.sponsor_id);
  const day = leagueDate();
  const views = kind === "view" ? 1 : 0;
  const clicks = kind === "click" ? 1 : 0;
  await prisma.$executeRaw`
    INSERT INTO "SponsorDailyStat" ("sponsor_id", "league_id", "day", "views", "clicks")
    SELECT unnest(${ids}::int[]), ${league_id}, ${day}::date, ${views}, ${clicks}
    ON CONFLICT ("sponsor_id", "league_id", "day")
    DO UPDATE SET "views" = "SponsorDailyStat"."views" + EXCLUDED."views", "clicks" = "SponsorDailyStat"."clicks" + EXCLUDED."clicks"`;
}
