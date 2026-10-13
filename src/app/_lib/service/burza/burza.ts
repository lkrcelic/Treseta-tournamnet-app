import {BurzaAvailability, BurzaCreate, BurzaKind, BurzaPost, MyBurzaList, MyBurzaPost} from "@/app/_interfaces/burza";
import {
  endsOn,
  nightGone,
  partnerError,
  postStatus,
  repostError,
  StatusContext,
  StatusPost,
  stillUpIds,
  SubstituteFacts,
  substituteError,
  TwinAd,
  twinFields,
} from "@/app/_lib/burzaStatus";
import {ACCOUNT_DEACTIVATED} from "@/app/_interfaces/login";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {normalizePhone, PHONE_ERROR} from "@/app/_lib/phone";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {isAdmin} from "@/app/_lib/service/auth/requireUser";
import {nightValue} from "@/app/_lib/service/league/nights";
import {displayName} from "@/app/_lib/players/names";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {Player, Prisma} from "@prisma/client";

// Burza igrača: the ads teams and players publish. The open ones are public; publishing and closing need a login.

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
// pg_advisory_xact_lock(PLAYER_LOCK, playerId): one ad change at a time per player, so a double tap doesn't publish
// twice (lockPlayerAds; also taken when an admin deactivates or deletes the player)
const PLAYER_LOCK = 7101;
const KIND_ORDER: Record<BurzaKind, number> = {SUBSTITUTE: 0, PARTNER: 1, AVAILABLE: 2};

type Tx = Prisma.TransactionClient;

// Takes the player's ad lock (PLAYER_LOCK) for the rest of the transaction. Take it before writing the player's row:
// publishing writes the row after it (save_phone), so the other order could deadlock.
export async function lockPlayerAds(tx: Tx, playerId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLAYER_LOCK}::int, ${playerId}::int)`;
}

// The ad lock for an author publishing, and a check that an admin hasn't deactivated or deleted them meanwhile
// (that holds the same lock while it closes or deletes their ads)
async function lockAuthor(tx: Tx, playerId: number) {
  await lockPlayerAds(tx, playerId);
  const author = await tx.player.findUnique({where: {id: playerId}, select: {active: true}});
  if (!author?.active) throw new InvalidResultError(ACCOUNT_DEACTIVATED);
}

const postInclude = {
  player: {
    select: {id: true, first_name: true, last_name: true, rating: true, phone: true, _count: {select: {ratingHistory: true}}},
  },
  withPlayer: {select: {first_name: true, last_name: true, rating: true, _count: {select: {ratingHistory: true}}}},
  league: {select: {league_id: true, league_name: true, end_date: true}},
  team: {select: {team_id: true, team_name: true}},
} satisfies Prisma.MarketPostInclude;

type PostRow = Prisma.MarketPostGetPayload<{include: typeof postInclude}>;

// today and the league nights from today on (StatusContext), the viewer, their teams, and the team they play for on
// each upcoming night
type ViewContext = StatusContext & {
  viewer: Player | null;
  myTeams: Set<number>;
  busy: Map<string, string>;
};

// today and the nights from today on of the substitute ads' leagues: what postStatus needs
async function statusContext(db: Tx, posts: {kind: BurzaKind; league_id: number | null}[]): Promise<StatusContext> {
  const today = leagueDateString();
  const leagueIds = Array.from(new Set(posts.filter((p) => p.kind === "SUBSTITUTE" && p.league_id != null).map((p) => p.league_id!)));
  const nightRows = leagueIds.length
    ? await db.leagueNight.findMany({where: {league_id: {in: leagueIds}, night: {gte: nightValue(today)}}, select: {league_id: true, night: true}})
    : [];
  return {today, nights: new Set(nightRows.map((n) => `${n.league_id}|${isoDate(n.night)}`))};
}

async function viewContext(viewer: Player | null, posts: PostRow[]): Promise<ViewContext> {
  const from = nightValue(leagueDateString());
  const [status, teams] = await Promise.all([
    statusContext(prisma, posts),
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
    ...status,
    viewer,
    myTeams: new Set(teams.map((t) => t.team_id)),
    busy,
  };
}

// What an ad's status depends on (_lib/burzaStatus.ts)
function statusOf(p: {kind: BurzaKind; closed_at: Date | null; league_id: number | null; night: Date | null; league: {end_date: Date | null} | null}): StatusPost {
  return {
    kind: p.kind,
    closed: p.closed_at != null,
    league_id: p.league_id,
    night: p.night ? isoDate(p.night) : null,
    league_end: p.league?.end_date ? isoDate(p.league.end_date) : null,
  };
}

function toView(p: PostRow, ctx: ViewContext): BurzaPost {
  const mine = ctx.viewer?.id === p.player_id;
  // closed by its author, its night has passed (or was taken off the league's nights), or its league has ended
  const closed = postStatus(statusOf(p), ctx) !== "ACTIVE";
  const night = p.night ? isoDate(p.night) : null;
  // an availability ad without its own number shows the profile's
  const phone = p.phone ?? (p.kind === "AVAILABLE" ? p.player.phone : null);
  const ownTeam = p.team_id != null && ctx.myTeams.has(p.team_id);
  return {
    id: p.id,
    kind: p.kind,
    created_at: p.created_at.toISOString(),
    closed,
    author: {id: p.player.id, name: displayName(p.player)},
    team: p.team ? {id: p.team.team_id, name: p.team.team_name} : null,
    league: p.league ? {id: p.league.league_id, name: p.league.league_name} : null,
    night,
    with_player: p.withPlayer ? displayName(p.withPlayer) : null,
    with_rating: p.withPlayer && p.withPlayer._count.ratingHistory > 0 ? p.withPlayer.rating : null,
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

// One of the viewer's own ads, with its status for Moji oglasi
function toMyView(p: PostRow, ctx: ViewContext): MyBurzaPost {
  const status = statusOf(p);
  return {
    ...toView(p, ctx),
    status: postStatus(status, ctx),
    ends_on: endsOn(status),
    closed_at: p.closed_at?.toISOString() ?? null,
    night_gone: nightGone(status, ctx),
    with_player_id: p.with_player_id,
  };
}

// how many past ads Moji oglasi lists
const PAST_LIMIT = 50;

// Moji oglasi: the player's own ads. Aktivni newest first; Prošli (expired or closed) by when they ended, the latest
// first.
export async function listMyPosts(user: Player): Promise<MyBurzaList> {
  const rows = await prisma.marketPost.findMany({where: {player_id: user.id}, include: postInclude, orderBy: [{created_at: "desc"}, {id: "desc"}]});
  const ctx = await viewContext(user, rows);
  const posts = rows.map((p) => toMyView(p, ctx));
  // closed by hand: that moment; expired: its night or the league's end
  const ended = (p: MyBurzaPost) => p.closed_at ?? p.ends_on ?? "";
  return {
    active: posts.filter((p) => p.status === "ACTIVE"),
    past: posts
      .filter((p) => p.status !== "ACTIVE")
      .sort((a, b) => ended(b).localeCompare(ended(a)) || b.id - a.id)
      .slice(0, PAST_LIMIT),
  };
}

async function getMyPostView(id: number, user: Player): Promise<MyBurzaPost> {
  const row = await prisma.marketPost.findUniqueOrThrow({where: {id}, include: postInclude});
  return toMyView(row, await viewContext(user, [row]));
}

// Moji oglasi · Objavi ponovno: the author puts a closed or expired ad up again, in place (it is published anew:
// created_at moves to now). A substitute ad goes up on the given night, or its own while that is still ahead. An ad
// that is still up is returned as it is, and so is an open ad that is the same as this one (no second copy).
// Returns "forbidden" for someone else's ad.
export async function repostPost(user: Player, id: number, night?: string): Promise<MyBurzaPost | "forbidden"> {
  const result = await prisma.$transaction(async (tx) => {
    await lockAuthor(tx, user.id);
    const p = await tx.marketPost.findUnique({where: {id}, include: {league: {select: {end_date: true}}}});
    if (!p) throw new NotFoundError("Oglas ne postoji.");
    if (p.player_id !== user.id) return "forbidden" as const;

    const own = p.night ? isoDate(p.night) : null;
    const target = p.kind === "SUBSTITUTE" ? night ?? own : null;
    const error = repostError({
      post: {...statusOf(p), player_id: p.player_id},
      userId: user.id,
      today: leagueDateString(),
      substitute: p.kind === "SUBSTITUTE" ? await substituteFacts(tx, user, {team_id: p.team_id, league_id: p.league_id, with_player_id: p.with_player_id, night: target}) : null,
      phone: (p.phone ?? user.phone) != null,
    });
    if (error) throw new InvalidResultError(error.message);

    // still up (the checks above passed, so an open ad on the same night isn't over)
    if (!p.closed_at && target === own) return p.id;
    const twin = await findTwin(tx, user.id, {kind: p.kind, team_id: p.team_id, league_id: p.league_id, night: target, with_player_id: p.with_player_id}, p.id);
    if (twin != null) return twin;

    await tx.marketPost.update({
      where: {id: p.id},
      data: {closed_at: null, created_at: new Date(), ...(target ? {night: nightValue(target)} : {})},
    });
    return p.id;
  });
  if (result === "forbidden") return result;
  return getMyPostView(result, user);
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
    await lockAuthor(tx, user.id);
    if (req.save_phone) await tx.player.update({where: {id: user.id}, data: {phone}});
    if (req.kind === "SUBSTITUTE") return createSubstitute(tx, user, req, phone);
    if (req.kind === "PARTNER") return createPartner(tx, user, req, phone);
    return saveAvailable(tx, user.id, {as_substitute: req.as_substitute, as_partner: req.as_partner, note: req.note, phone: req.save_phone ? null : phone});
  });
  return (await getPostView(id, user))!;
}

type Req<K extends BurzaKind> = Extract<BurzaCreate, {kind: K}>;

// What the substitute checks (_lib/burzaStatus.ts) need to know about the team and the night; null when the team
// doesn't exist
async function substituteFacts(
  tx: Tx,
  user: Player,
  ad: {team_id: number | null; league_id: number | null; with_player_id: number | null; night: string | null}
): Promise<SubstituteFacts | null> {
  if (ad.team_id == null || ad.team_id === BYE_TEAM_ID || ad.league_id == null) return null;
  const team = await tx.team.findUnique({
    where: {team_id: ad.team_id},
    select: {teamPlayers: {select: {player_id: true, player: {select: {active: true}}}}, leagueTeams: {where: {league_id: ad.league_id}, select: {league_id: true}}},
  });
  if (!team) return null;
  const players = team.teamPlayers.map((tp) => tp.player_id);
  const leagueNight = ad.night != null && (await tx.leagueNight.count({where: {league_id: ad.league_id, night: nightValue(ad.night)}})) > 0;
  return {
    admin: isAdmin(user),
    onTeam: players.includes(user.id),
    teamInLeague: team.leagueTeams.length > 0,
    // a deactivated (or deleted) teammate can't play with the substitute
    withOnTeam: team.teamPlayers.some((tp) => tp.player_id === ad.with_player_id && tp.player.active),
    night: ad.night,
    leagueNight,
    today: leagueDateString(),
  };
}

// The player's open ad that this one would copy (_lib/burzaStatus.ts twinFields), except the ad itself
async function findTwin(tx: Tx, playerId: number, ad: TwinAd, except?: number): Promise<number | null> {
  const {night, ...fields} = twinFields(ad);
  const twin = await tx.marketPost.findFirst({
    where: {
      ...fields,
      ...(night !== undefined ? {night: night ? nightValue(night) : null} : {}),
      player_id: playerId,
      closed_at: null,
      ...(except != null ? {id: {not: except}} : {}),
    },
    select: {id: true},
    orderBy: {id: "desc"},
  });
  return twin?.id ?? null;
}

async function createSubstitute(tx: Tx, user: Player, req: Req<"SUBSTITUTE">, phone: string): Promise<number> {
  const facts = await substituteFacts(tx, user, {team_id: req.team_id, league_id: req.league_id, with_player_id: req.with_player_id, night: req.night});
  if (!facts) throw new NotFoundError("Ekipa ne postoji.");
  const error = substituteError(facts, "create");
  if (error) throw new InvalidResultError(error);

  const same = await findTwin(tx, user.id, {kind: "SUBSTITUTE", team_id: req.team_id, league_id: req.league_id, night: req.night, with_player_id: req.with_player_id});
  if (same != null) {
    await tx.marketPost.update({where: {id: same}, data: {phone, note: req.note}});
    return same;
  }
  const post = await tx.marketPost.create({
    data: {kind: "SUBSTITUTE", player_id: user.id, league_id: req.league_id, team_id: req.team_id, night: nightValue(req.night), with_player_id: req.with_player_id, phone, note: req.note},
  });
  return post.id;
}

async function createPartner(tx: Tx, user: Player, req: Req<"PARTNER">, phone: string): Promise<number> {
  const league = await tx.league.findUnique({where: {league_id: req.league_id}, select: {end_date: true}});
  if (!league) throw new NotFoundError("Liga ne postoji.");
  const error = partnerError(league.end_date ? isoDate(league.end_date) : null, leagueDateString());
  if (error) throw new InvalidResultError(error);

  const same = await findTwin(tx, user.id, {kind: "PARTNER", team_id: null, league_id: req.league_id, night: null, with_player_id: null});
  if (same != null) {
    await tx.marketPost.update({where: {id: same}, data: {phone, note: req.note}});
    return same;
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
  const open = await findTwin(tx, playerId, {kind: "AVAILABLE", team_id: null, league_id: null, night: null, with_player_id: null});
  if (open != null) {
    await tx.marketPost.update({where: {id: open}, data});
    return open;
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

// Deaktiviraj račun (admin): closes the player's ads that are still up. An ad that already expired stays as it is, so
// Moji oglasi keeps showing it as Istekao on its own date (stillUpIds). Call it after lockPlayerAds(tx, playerId).
export async function closeActivePosts(tx: Tx, playerId: number): Promise<void> {
  const open = await tx.marketPost.findMany({
    where: {player_id: playerId, closed_at: null},
    select: {id: true, kind: true, closed_at: true, league_id: true, night: true, league: {select: {end_date: true}}},
  });
  const ids = stillUpIds(open.map((p) => ({...statusOf(p), id: p.id})), await statusContext(tx, open));
  if (ids.length) await tx.marketPost.updateMany({where: {id: {in: ids}}, data: {closed_at: new Date()}});
}
