// Players and teams at production scale (14.11.2026: 416 players, 180 teams), with the accounts the tests log in as
// and the odd cases the app must survive: no birth date, no smoker answer, no team, two teams, a team of three,
// photos with every visibility, a deactivated and a locked account, the longest team name.
import type {Player, Team} from "@prisma/client";
import {makePng, TEST_PASSWORD_HASH, type Ctx} from "../context";
import {LONG_TEAM_NAME, makePeople, makeTeamNames} from "../names";

export type People = {
  admin: Player;
  admin2: Player;
  organizer: Player;
  player: Player; // the plain player the tests log in as; plays in the current league
  partner: Player; // the player's teammate
  players: Player[]; // every generated player (not the fixed accounts)
  teams: Team[]; // every team except bye, in creation order
  playerTeam: Team; // the team of `player` and `partner`
  rosters: Map<number, number[]>; // team id → player ids
  activeRosters: Map<number, number[]>; // the same without deactivated players (who can't be in a lineup)
};

const PLAYER_COUNT = 400;
const TEAM_COUNT = 178;

type FixedAccount = {
  key: string;
  username: string;
  role: "ADMIN" | "ORGANIZER" | "PLAYER";
  first_name: string;
  last_name: string;
  complete?: boolean; // birth date and smoker answer filled in (default true)
  active?: boolean;
};

const FIXED: FixedAccount[] = [
  {key: "admin", username: "admin", role: "ADMIN", first_name: "Ana", last_name: "Adminić"},
  {key: "admin2", username: "admin2", role: "ADMIN", first_name: "Boris", last_name: "Drugić"},
  {key: "organizer", username: "organizer", role: "ORGANIZER", first_name: "Oliver", last_name: "Organizator"},
  {key: "player", username: "player", role: "PLAYER", first_name: "Petar", last_name: "Igračić"},
  {key: "partner", username: "partner", role: "PLAYER", first_name: "Pavao", last_name: "Partnerić"},
  // signs in to a sheet asking for the birth date and Pušiš li? (sign-ups from before those questions)
  {key: "onboarding", username: "novi.igrac", role: "PLAYER", first_name: "Nino", last_name: "Novaković", complete: false},
  // in no team at all
  {key: "noTeam", username: "bez.ekipe", role: "PLAYER", first_name: "Bruno", last_name: "Samić"},
  // deactivated by an admin: can't log in
  {key: "inactive", username: "deaktiviran", role: "PLAYER", first_name: "Dado", last_name: "Ugašeni", active: false},
  // for the login-lock test, which locks it itself: the 5-attempt limit lives in the server's memory and the database
  // one (LoginFailure, >20 in 15 min) expires, so a lock made by the seed would be gone before the tests run
  {key: "locked", username: "zakljucan", role: "PLAYER", first_name: "Zlatko", last_name: "Zaključani"},
];

export async function seedPeople(ctx: Ctx): Promise<People> {
  const {prisma} = ctx;
  const rng = ctx.rng.fork("people");
  const birthDate = () => new Date(Date.UTC(rng.int(1950, 2004), rng.int(0, 11), rng.int(1, 28)));

  const fixed: Record<string, Player> = {};
  for (const account of FIXED) {
    const complete = account.complete ?? true;
    fixed[account.key] = await prisma.player.create({
      data: {
        username: account.username,
        password_hash: TEST_PASSWORD_HASH,
        email: `${account.username}@e2e.test`,
        player_role: account.role,
        first_name: account.first_name,
        last_name: account.last_name,
        birth_date: complete ? birthDate() : null,
        smoker: false,
        smoker_answered: complete,
        phone: account.role === "PLAYER" ? null : "+385 91 000 0001",
        active: account.active ?? true,
      },
    });
  }
  // the generated players, shaped like production: ~60% gave a birth date, ~40% answered the smoker question
  const taken = new Set(FIXED.map((a) => a.username));
  const people = makePeople(rng, PLAYER_COUNT, taken);
  const players = await prisma.player.createManyAndReturn({
    data: people.map((p) => {
      const answered = rng.chance(0.45);
      return {
        ...p,
        password_hash: TEST_PASSWORD_HASH,
        player_role: "PLAYER" as const,
        birth_date: rng.chance(0.6) ? birthDate() : null,
        smoker_answered: answered,
        smoker: answered && rng.chance(0.45),
        phone: rng.chance(0.12) ? `+385 9${rng.int(1, 9)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}` : null,
        active: !rng.chance(0.02),
        photo_visibility: rng.weighted([
          ["ALL", 6],
          ["TEAMMATES", 2],
          ["ME", 1],
        ] as const),
      };
    }),
  });

  // teams: mostly two players, some three; a few players play in two teams, ~15% in none
  const teamNames = makeTeamNames(rng, TEAM_COUNT, new Set(["bye", LONG_TEAM_NAME]));
  await prisma.team.create({data: {team_id: 0, team_name: "bye", creator_id: fixed.admin.id}});
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Team"', 'team_id'), 1, false)`;

  const pool = rng.shuffle(players.filter((p) => p.active));
  const benched = new Set(pool.slice(0, Math.round(pool.length * 0.15)).map((p) => p.id));
  const free = pool.filter((p) => !benched.has(p.id));
  const rosters = new Map<number, number[]>();
  const teams: Team[] = [];

  const playerTeam = await prisma.team.create({
    data: {
      team_name: "Igračići",
      creator_id: fixed.player.id,
      founder_id1: fixed.player.id,
      founder_id2: fixed.partner.id,
    },
  });
  teams.push(playerTeam);
  rosters.set(playerTeam.team_id, [fixed.player.id, fixed.partner.id]);

  let cursor = 0;
  const nextFree = () => free[cursor++ % free.length];
  for (let i = 0; i < teamNames.length; i++) {
    const size = rng.chance(0.08) ? 3 : 2;
    const members = new Set<number>();
    while (members.size < size) members.add(nextFree().id);
    const ids = Array.from(members);
    const name = i === 7 ? LONG_TEAM_NAME : teamNames[i];
    const team = await prisma.team.create({
      data: {team_name: name, creator_id: ids[0], founder_id1: ids[0], founder_id2: ids[1]},
    });
    teams.push(team);
    rosters.set(team.team_id, ids);
  }
  // the organizer and the second admin play too, in their own teams
  for (const [owner, name] of [
    [fixed.organizer, "Organizatorova ekipa"],
    [fixed.admin2, "Adminovi asovi"],
  ] as const) {
    const mate = nextFree();
    const team = await prisma.team.create({
      data: {team_name: name, creator_id: owner.id, founder_id1: owner.id, founder_id2: mate.id},
    });
    teams.push(team);
    rosters.set(team.team_id, [owner.id, mate.id]);
  }

  await prisma.teamPlayer.createMany({
    data: Array.from(rosters).flatMap(([team_id, ids]) => ids.map((player_id) => ({team_id, player_id}))),
  });

  // photos: ~4% of players, ~10% of teams, every visibility
  for (const p of rng.sample(players, Math.round(players.length * 0.04))) {
    await prisma.playerPhoto.create({
      data: {player_id: p.id, photo: makePng([rng.int(60, 230), rng.int(60, 230), rng.int(60, 230)]), type: "image/png"},
    });
    await prisma.player.update({where: {id: p.id}, data: {photo_updated_at: ctx.now}});
  }
  for (const t of rng.sample(teams.slice(1), Math.round(teams.length * 0.1))) {
    const ids = rosters.get(t.team_id)!;
    await prisma.teamPhoto.create({
      data: {team_id: t.team_id, photo: makePng([rng.int(60, 230), rng.int(60, 230), rng.int(60, 230)]), type: "image/png"},
    });
    await prisma.team.update({
      where: {team_id: t.team_id},
      data: {
        photo_updated_at: ctx.now,
        photo_updated_by: ids[0],
        photo_visibility: rng.chance(0.7) ? "ALL" : "TEAMMATES",
      },
    });
  }
  // the player's own photo, visible to teammates only, so the profile and team pages show both cases
  await prisma.playerPhoto.create({data: {player_id: fixed.player.id, photo: makePng([40, 90, 160]), type: "image/png"}});
  await prisma.player.update({
    where: {id: fixed.player.id},
    data: {photo_updated_at: ctx.now, photo_visibility: "TEAMMATES"},
  });

  for (const account of FIXED) {
    const p = fixed[account.key];
    ctx.catalog.accounts[account.key] = {
      id: p.id,
      username: p.username,
      role: p.player_role,
      teams: Array.from(rosters).filter(([, ids]) => ids.includes(p.id)).map(([id]) => id),
    };
  }
  ctx.catalog.teams.player = {id: playerTeam.team_id, name: playerTeam.team_name};
  ctx.log(`people: ${players.length + FIXED.length} players, ${teams.length} teams (+ bye)`);

  const inactive = new Set([...players, ...Object.values(fixed)].filter((p) => !p.active).map((p) => p.id));
  const activeRosters = new Map(Array.from(rosters).map(([teamId, ids]) => [teamId, ids.filter((id) => !inactive.has(id))]));

  return {
    activeRosters,
    admin: fixed.admin,
    admin2: fixed.admin2,
    organizer: fixed.organizer,
    player: fixed.player,
    partner: fixed.partner,
    players,
    teams,
    playerTeam,
    rosters,
  };
}
