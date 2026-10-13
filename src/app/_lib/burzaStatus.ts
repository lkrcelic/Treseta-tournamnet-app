// Whether a Burza ad is still up (Moji oglasi: Aktivan, Istekao, Zatvoren), and the checks for publishing one, new or
// again. Framework free so it can be unit tested; the service gathers the facts from the database.
import type {BurzaKind, BurzaStatus} from "@/app/_interfaces/burza";

// An ad as its status needs it; dates are YYYY-MM-DD
export type StatusPost = {
  kind: BurzaKind;
  closed: boolean; // closed by its author or an admin
  league_id: number | null;
  night: string | null; // SUBSTITUTE
  league_end: string | null; // the league's end date (PARTNER)
};

export type StatusContext = {
  today: string;
  // "leagueId|YYYY-MM-DD" of the league nights from today on (a substitute ad whose night was removed is over)
  nights: Set<string>;
};

// A substitute ad whose night has passed or was taken off the league's nights: publishing it again needs a new night
export function nightGone(p: StatusPost, ctx: StatusContext): boolean {
  if (p.kind !== "SUBSTITUTE" || !p.night) return false;
  return p.night < ctx.today || !ctx.nights.has(`${p.league_id}|${p.night}`);
}

// Closed by hand beats expired. A substitute ad expires after its night (it is still up on the night itself), a
// partner ad when its league's end date has passed; an availability ad stays until it is closed.
export function postStatus(p: StatusPost, ctx: StatusContext): BurzaStatus {
  if (p.closed) return "CLOSED";
  if (nightGone(p, ctx)) return "EXPIRED";
  if (p.kind === "PARTNER" && partnerError(p.league_end, ctx.today)) return "EXPIRED";
  return "ACTIVE";
}

// The ads among these that are still up. Deaktiviraj račun closes only those: an ad that already expired keeps its
// own end, so Moji oglasi still says Istekao with its night or league end, not Zatvoren on the day of deactivation.
export function stillUpIds(posts: (StatusPost & {id: number})[], ctx: StatusContext): number[] {
  return posts.filter((p) => postStatus(p, ctx) === "ACTIVE").map((p) => p.id);
}

// The day the ad closes by itself: a substitute ad's night, a partner ad's league end; null when only its author closes it
export function endsOn(p: StatusPost): string | null {
  if (p.kind === "SUBSTITUTE") return p.night;
  if (p.kind === "PARTNER") return p.league_end;
  return null;
}

// Trebam zamjenu, new or published again: what its checks need to know about the team and the night
export type SubstituteFacts = {
  admin: boolean; // an admin may post for any team
  onTeam: boolean; // the author plays for the team
  teamInLeague: boolean; // the team plays in the ad's league
  withOnTeam: boolean; // the player the substitute plays with is an active player of the team
  night: string | null; // the night the ad goes up on
  leagueNight: boolean; // the league plays that night
  today: string;
};

// The same rules for a new ad and for one published again (Moji oglasi), each said its own way
const SUBSTITUTE_COPY = {
  create: {
    team: "Zamjenu možeš tražiti samo za svoju ekipu.",
    league: "Ekipa ne igra u ovoj ligi.",
    with: "Igrač s kojim zamjena igra mora biti u ekipi.",
    past: "Ta večer je već prošla.",
    night: "Liga te večeri ne igra.",
  },
  repost: {
    team: "Više nisi u toj ekipi.",
    league: "Ekipa više ne igra u toj ligi.",
    with: "Igrač s kojim zamjena igra više nije u ekipi.",
    past: "Odaberi novu večer.",
    night: "Odaberi novu večer.",
  },
} as const;

// Why a substitute ad can't go up, or null when it can
export function substituteError(f: SubstituteFacts, mode: "create" | "repost"): string | null {
  const copy = SUBSTITUTE_COPY[mode];
  if (!f.onTeam && !f.admin) return copy.team;
  if (!f.teamInLeague) return copy.league;
  if (!f.withOnTeam) return copy.with;
  if (!f.night || f.night < f.today) return copy.past;
  if (!f.leagueNight) return copy.night;
  return null;
}

export const LEAGUE_ENDED = "Ova liga je završila.";

// Tražim partnera, new or published again: its league must not have ended
export function partnerError(leagueEnd: string | null, today: string): string | null {
  return leagueEnd != null && leagueEnd < today ? LEAGUE_ENDED : null;
}

export const REPOST_FORBIDDEN = "Možeš ponovno objaviti samo svoj oglas.";
// Burza lists an availability ad only with a phone number (its own or the profile's); Moji oglasi opens the form
export const REPOST_NO_PHONE = "Oglas nema broja mobitela. Upiši ga na Moj profil.";

// What "Objavi ponovno" checks
export type RepostFacts = {
  post: StatusPost & {player_id: number};
  userId: number;
  today: string;
  // SUBSTITUTE: the team and the night it would go up on (a new one, or its own); null when its team is gone
  substitute: SubstituteFacts | null;
  // AVAILABLE: it has a phone number, its own or the profile's
  phone: boolean;
};

// Why the ad can't go up again (403 for someone else's ad, admins included; otherwise 400), or null when it can
export function repostError(f: RepostFacts): {status: 400 | 403; message: string} | null {
  if (f.post.player_id !== f.userId) return {status: 403, message: REPOST_FORBIDDEN};
  const message = kindError(f);
  return message ? {status: 400, message} : null;
}

function kindError(f: RepostFacts): string | null {
  if (f.post.kind === "SUBSTITUTE") return f.substitute ? substituteError(f.substitute, "repost") : SUBSTITUTE_COPY.repost.team;
  if (f.post.kind === "PARTNER") return partnerError(f.post.league_end, f.today);
  return f.phone ? null : REPOST_NO_PHONE;
}

// The open ad of the player's that a new or published-again ad would copy; it is updated or returned instead of a
// second one. These fields must match: the team, night and player for a substitute ad, the league for a partner ad,
// and only the kind for an availability ad (a player has one).
export type TwinAd = {kind: BurzaKind; team_id: number | null; league_id: number | null; night: string | null; with_player_id: number | null};

export function twinFields(ad: TwinAd): Partial<TwinAd> & {kind: BurzaKind} {
  if (ad.kind === "SUBSTITUTE") return {kind: ad.kind, team_id: ad.team_id, night: ad.night, with_player_id: ad.with_player_id};
  if (ad.kind === "PARTNER") return {kind: ad.kind, league_id: ad.league_id};
  return {kind: ad.kind};
}
