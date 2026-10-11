// prisma/seed.ts
// Local data for `npm run dev:reset`: the users `admin` and `player` (password `sifra`), the bye team, and one league
// with 8 teams of two in two conferences.

import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

// argon2 hash of "sifra"
const PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$pDs5fiTYGTo0XSEt/3Cf7w$x8wFo37pR763HFqVMKupfveO0dBebHhLweI15eac8EI";

const PLAYERS: [username: string, firstName: string, lastName: string][] = [
  ["player", "Ivan", "Horvat"],
  ["marko", "Marko", "Kovačević"],
  ["ana", "Ana", "Babić"],
  ["luka", "Luka", "Marić"],
  ["petra", "Petra", "Jurić"],
  ["josip", "Josip", "Novak"],
  ["maja", "Maja", "Knežević"],
  ["tomislav", "Tomislav", "Vuković"],
  ["ivana", "Ivana", "Matić"],
  ["ante", "Ante", "Pavić"],
  ["kata", "Kata", "Božić"],
  ["roko", "Roko", "Šučević"],
  ["lucija", "Lucija", "Grgić"],
  ["mate", "Mate", "Perić"],
  ["nika", "Nika", "Radić"],
  ["stipe", "Stipe", "Barišić"],
];

const TEAMS = [
  "Alen Kitasović",
  "Imotske Šarulje",
  "Špicom u stomak",
  "Mujo i Haso",
  "Barcelona",
  "Dubec kartel",
  "Astletičari",
  "Lavovi",
];

async function main() {
  const admin = await prisma.player.create({
    data: {
      username: "admin",
      password_hash: PASSWORD_HASH,
      email: "admin@example.com",
      player_role: "ADMIN",
      first_name: "Admin",
      last_name: "Lige",
      birth_date: new Date("1985-03-12T00:00:00.000Z"),
    },
  });

  const players = [];
  for (const [username, first_name, last_name] of PLAYERS) {
    players.push(
      await prisma.player.create({
        data: {
          username,
          password_hash: PASSWORD_HASH,
          email: `${username}@example.com`,
          player_role: "PLAYER",
          first_name,
          last_name,
          birth_date: new Date("1990-01-15T00:00:00.000Z"),
        },
      })
    );
  }

  // The team a team without an opponent plays against; the standings SQL expects it to be team 0
  await prisma.team.create({data: {team_id: 0, team_name: "Bye", creator_id: admin.id}});

  const teams = [];
  for (let i = 0; i < TEAMS.length; i++) {
    const [p1, p2] = [players[2 * i], players[2 * i + 1]];
    teams.push(
      await prisma.team.create({
        data: {
          team_name: TEAMS[i],
          creator_id: admin.id,
          founder_id1: p1.id,
          founder_id2: p2.id,
          teamPlayers: {create: [{player_id: p1.id}, {player_id: p2.id}]},
        },
      })
    );
  }

  const league = await prisma.league.create({
    data: {
      league_name: "Trešeta liga 2026",
      season: "2026",
      start_date: new Date("2026-01-08T00:00:00.000Z"),
      play_day: 3,
      rounds_per_night: 3,
      leagueTeams: {create: teams.map((t) => ({team_id: t.team_id}))},
      conferences: {
        create: [
          {name: "Sjever", color: "#2E6DB4", position: 0},
          {name: "Jug", color: "#C2410C", position: 1},
        ],
      },
    },
    include: {conferences: {orderBy: {position: "asc"}}},
  });

  // the first four teams in Sjever, the other four in Jug
  const [north, south] = league.conferences;
  await prisma.leagueTeam.updateMany({
    where: {league_id: league.league_id, team_id: {in: teams.slice(0, 4).map((t) => t.team_id)}},
    data: {conference_id: north.conference_id},
  });
  await prisma.leagueTeam.updateMany({
    where: {league_id: league.league_id, team_id: {in: teams.slice(4).map((t) => t.team_id)}},
    data: {conference_id: south.conference_id},
  });

  for (const team of teams) {
    await prisma.$executeRaw`CALL update_team_score(${team.team_id}, ${league.league_id})`;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
