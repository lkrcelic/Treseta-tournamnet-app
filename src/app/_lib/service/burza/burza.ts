import {BurzaAvailability, BurzaCreate, BurzaKind, BurzaPost} from "@/app/_interfaces/burza";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {normalizePhone, PHONE_ERROR} from "@/app/_lib/phone";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {isAdmin} from "@/app/_lib/service/auth/requireUser";
import {nightValue} from "@/app/_lib/service/league/nights";
import {playerName} from "@/app/_lib/service/league/schedule";
import {ratingInTens} from "@/app/_lib/ui/burza";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Player, Prisma} from "@prisma/client";

// Burza igrača: the ads teams and players publish. The open ones are public; publishing and closing need a login.

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
// pg_advisory_xact_lock(PLAYER_LOCK, playerId): one ad change at a time per player, so a double tap doesn't publish twice
const PLAYER_LOCK = 7101;
const KIND_ORDER: Record<BurzaKind, number> = {SUBSTITUTE: 0, PARTNER: 1, AVAILABLE: 2};

const postInclude = {
  player: {
    select: {id: true, first_name: true, last_name: true, username: true, rating: true, phone: true, _count: {select: {ratingHistory: true}}},
  },
  outPlayer: {select: {first_name: true, last_name: true, username: true}},
  league: {select: {league_id: true, league_name: true, end_date: true}},
  team: {select: {team_id: true, team_name: true, teamPlayers: {select: {player: {select: {rating: true}}}}}},
} satisfies Prisma.MarketPostInclude;

type PostRow = Prisma.MarketPostGetPayload<{include: typeof postInclude}>;

type ViewContext = {
  viewer: Player | null;
  today: string;
  // "leagueId|YYYY-MM-DD" of the league nights from today on (a substitute ad whose night was removed is over)
  nights: Set<string>;
  // the viewer's teams, and the team they play for on each upcoming night
  myTeams: Set<number>;
  busy: Map<string, string>;
};

async function viewContext(viewer: Player | null, posts: PostRow[]): Promise<ViewContext> {
  const today = leagueDateString();
  const from = nightValue(today);
  const leagueIds = Array.from(new Set(posts.filter((p) => p.kind === "SUBSTITUTE" && p.league_id != null).map((p) => p.league_id!)));
  const [nightRows, teams] = await Promise.all([
    leagueIds.length
      ? prisma.leagueNight.findMany({where: {league_id: {in: leagueIds}, night: {gte: from}}, select: {league_id: true, night: true}})
      : Promise.resolve([]),
    viewer
      ? prisma.team.findMany({
          where: {team_id: {not: BYE_TEAM_ID}, teamPlayers: {some: {player_id: viewer.id}}},
          select: {
            team_id: true,
            team_name: true,
            leagueTeams: {where: {active: true}, select: {league: {select: {nights: {where: {night: {gte: from}}, select: {night: true}}}}}},
          },
        })
      : Promise.resolve([]),
  ]);

  const busy = new Map<string, string>();
  for (const t of teams) {
    for (const lt of t.leagueTeams) {
      for (const n of lt.league.nights) {
        const night = isoDate(n.night);
        if (!busy.has(night)) busy.set(night, t.team_name);
      }
    }
  }
  return {
    viewer,
    today,
    nights: new Set(nightRows.map((n) => `${n.league_id}|${isoDate(n.night)}`)),
    myTeams: new Set(teams.map((t) => t.team_id)),
    busy,
  };
}

// Closed by its author, its night has passed (or was taken off the league's nights), or its league has ended
function isOver(p: PostRow, ctx: ViewContext): boolean {
  if (p.closed_at) return true;
  if (p.kind === "SUBSTITUTE") {
    const night = isoDate(p.night!);
    return night < ctx.today || !ctx.nights.has(`${p.league_id}|${night}`);
  }
  if (p.kind === "PARTNER") return p.league?.end_date != null && isoDate(p.league.end_date) < ctx.today;
  return false;
}

function toView(p: PostRow, ctx: ViewContext): BurzaPost {
  const mine = ctx.viewer?.id === p.player_id;
  const closed = isOver(p, ctx);
  const night = p.night ? isoDate(p.night) : null;
  // an availability ad without its own number shows the profile's
  const phone = p.phone ?? (p.kind === "AVAILABLE" ? p.player.phone : null);
  const ownTeam = p.team_id != null && ctx.myTeams.has(p.team_id);
  return {
    id: p.id,
    kind: p.kind,
    created_at: p.created_at.toISOString(),
    closed,
    author: {id: p.player.id, name: playerName(p.player)},
    team: p.team ? {id: p.team.team_id, name: p.team.team_name} : null,
    league: p.league ? {id: p.league.league_id, name: p.league.league_name} : null,
    night,
    out_player: p.outPlayer ? playerName(p.outPlayer) : null,
    team_rating: p.team ? ratingInTens(p.team.teamPlayers.map((tp) => tp.player.rating)) : null,
    rating: p.player._count.ratingHistory > 0 ? p.player.rating : null,
    as_substitute: p.as_substitute,
    as_partner: p.as_partner,
    note: p.note,
    phone: closed && !mine ? null : phone,
    mine,
    can_close: !closed && (mine || (ctx.viewer != null && isAdmin(ctx.viewer))),
    busy_team: p.kind === "SUBSTITUTE" && night && !closed && !ownTeam ? ctx.busy.get(night) ?? null : null,
  };
}

// The open ads: substitutes first, then partners, then available players, newest first in each. An availability
// ad without any phone number (switched on in the profile before a number was added) isn't listed.
export async function listOpenPosts(viewer: Player | null): Promise<BurzaPost[]> {
  const from = nightValue(leagueDateString());
  const rows = await prisma.marketPost.findMany({
    where: {
      closed_at: null,
      OR: [
        {kind: "SUBSTITUTE", night: {gte: from}},
        {kind: "PARTNER", league: {OR: [{end_date: null}, {end_date: {gte: from}}]}},
        {kind: "AVAILABLE"},
      ],
    },
    include: postInclude,
    orderBy: [{created_at: "desc"}, {id: "desc"}],
  });
  const ctx = await viewContext(viewer, rows);
  return rows
    .map((p) => toView(p, ctx))
    .filter((p) => !p.closed && p.phone != null)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

// One ad, also a closed one (its page then says so, without the phone number); null when it doesn't exist
export async function getPostView(id: number, viewer: Player | null): Promise<BurzaPost | null> {
  const row = await prisma.marketPost.findUnique({where: {id}, include: postInclude});
  if (!row) return null;
  return toView(row, await viewContext(viewer, [row]));
}

// Publishes an ad. Publishing the same ad again (a double tap, or the form sent twice) updates the open one instead.
// save_phone also puts the number on the player's profile; an availability ad then follows the profile's number.
export async function createPost(user: Player, req: BurzaCreate): Promise<BurzaPost> {
  const phone = normalizePhone(req.phone);
  if (!phone) throw new InvalidResultError(PHONE_ERROR);
  const id = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAYER_LOCK}::int, ${user.id}::int)`;
    if (req.save_phone) await tx.player.update({where: {id: user.id}, data: {phone}});
    if (req.kind === "SUBSTITUTE") return createSubstitute(tx, user, req, phone);
    if (req.kind === "PARTNER") return createPartner(tx, user, req, phone);
    return saveAvailable(tx, user.id, {as_substitute: req.as_substitute, as_partner: req.as_partner, note: req.note, phone: req.save_phone ? null : phone});
  });
  return (await getPostView(id, user))!;
}

type Tx = Prisma.TransactionClient;
type Req<K extends BurzaKind> = Extract<BurzaCreate, {kind: K}>;

async function createSubstitute(tx: Tx, user: Player, req: Req<"SUBSTITUTE">, phone: string): Promise<number> {
  const team = await tx.team.findUnique({
    where: {team_id: req.team_id},
    select: {teamPlayers: {select: {player_id: true}}, leagueTeams: {where: {league_id: req.league_id}, select: {active: true}}},
  });
  if (!team || req.team_id === BYE_TEAM_ID) throw new NotFoundError("Ekipa ne postoji.");
  const players = team.teamPlayers.map((tp) => tp.player_id);
  if (!players.includes(user.id) && !isAdmin(user)) throw new InvalidResultError("Zamjenu možeš tražiti samo za svoju ekipu.");
  if (!team.leagueTeams.length) throw new InvalidResultError("Ekipa ne igra u ovoj ligi.");
  if (!players.includes(req.out_player_id)) throw new InvalidResultError("Igrač koji ne može mora biti u ekipi.");
  if (req.night < leagueDateString()) throw new InvalidResultError("Ta večer je već prošla.");
  const night = nightValue(req.night);
  if (!(await tx.leagueNight.count({where: {league_id: req.league_id, night}}))) {
    throw new InvalidResultError("Liga te večeri ne igra.");
  }

  const same = await tx.marketPost.findFirst({
    where: {kind: "SUBSTITUTE", closed_at: null, player_id: user.id, team_id: req.team_id, night, out_player_id: req.out_player_id},
    select: {id: true},
  });
  if (same) {
    await tx.marketPost.update({where: {id: same.id}, data: {phone, note: req.note}});
    return same.id;
  }
  const post = await tx.marketPost.create({
    data: {kind: "SUBSTITUTE", player_id: user.id, league_id: req.league_id, team_id: req.team_id, night, out_player_id: req.out_player_id, phone, note: req.note},
  });
  return post.id;
}

async function createPartner(tx: Tx, user: Player, req: Req<"PARTNER">, phone: string): Promise<number> {
  const league = await tx.league.findUnique({where: {league_id: req.league_id}, select: {end_date: true}});
  if (!league) throw new NotFoundError("Liga ne postoji.");
  if (league.end_date && isoDate(league.end_date) < leagueDateString()) throw new InvalidResultError("Ova liga je završila.");

  const same = await tx.marketPost.findFirst({where: {kind: "PARTNER", closed_at: null, player_id: user.id, league_id: req.league_id}, select: {id: true}});
  if (same) {
    await tx.marketPost.update({where: {id: same.id}, data: {phone, note: req.note}});
    return same.id;
  }
  const post = await tx.marketPost.create({data: {kind: "PARTNER", player_id: user.id, league_id: req.league_id, phone, note: req.note}});
  return post.id;
}

// A player has one open availability ad; it is updated instead of published again
async function saveAvailable(
  tx: Tx,
  playerId: number,
  data: {as_substitute: boolean; as_partner: boolean; note?: string; phone?: string | null}
): Promise<number> {
  const open = await tx.marketPost.findFirst({where: {kind: "AVAILABLE", closed_at: null, player_id: playerId}, select: {id: true}});
  if (open) {
    await tx.marketPost.update({where: {id: open.id}, data});
    return open.id;
  }
  const post = await tx.marketPost.create({data: {kind: "AVAILABLE", player_id: playerId, ...data}});
  return post.id;
}

// Closes an ad (its author or an admin). Returns "forbidden" for anyone else.
export async function closePost(user: Player, id: number): Promise<BurzaPost | "forbidden"> {
  const post = await prisma.marketPost.findUnique({where: {id}, select: {player_id: true, closed_at: true}});
  if (!post) throw new NotFoundError("Oglas ne postoji.");
  if (post.player_id !== user.id && !isAdmin(user)) return "forbidden";
  if (!post.closed_at) await prisma.marketPost.update({where: {id}, data: {closed_at: new Date()}});
  return (await getPostView(id, user))!;
}

// The player's profile number and their open availability ad (Profil · Burza igrača)
export async function getAvailability(playerId: number): Promise<BurzaAvailability> {
  const [player, post] = await Promise.all([
    prisma.player.findUnique({where: {id: playerId}, select: {phone: true}}),
    prisma.marketPost.findFirst({where: {kind: "AVAILABLE", closed_at: null, player_id: playerId}, orderBy: {id: "desc"}}),
  ]);
  return {
    phone: player?.phone ?? null,
    available: post ? {id: post.id, as_substitute: post.as_substitute, as_partner: post.as_partner, note: post.note, phone: post.phone} : null,
  };
}

// Profil · Dostupan sam: switching it on publishes the availability ad with the profile's number, switching it off
// closes it; the pills change as what the player is available
export async function setAvailability(
  playerId: number,
  req: {available: boolean; as_substitute: boolean; as_partner: boolean}
): Promise<BurzaAvailability> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAYER_LOCK}::int, ${playerId}::int)`;
    if (req.available) await saveAvailable(tx, playerId, {as_substitute: req.as_substitute, as_partner: req.as_partner});
    else await tx.marketPost.updateMany({where: {kind: "AVAILABLE", closed_at: null, player_id: playerId}, data: {closed_at: new Date()}});
  });
  return getAvailability(playerId);
}
