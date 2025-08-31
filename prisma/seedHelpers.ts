import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateString(length: number) {
  let result = " ";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

export async function createRandomPlayer() {
  // TODO:  implement retries (try multiple times if same username etc)
  const name = generateString(15);

  return await prisma.player.create({
    data: {
      username: name,
      password_hash: generateString(12),
      email: name + "@gmail.com",
      player_role: "PLAYER",
      first_name: generateString(5),
      last_name: generateString(5),
      birth_year: 1996,
      city: "Zagreb",
    },
  });
}

export async function createRandomTeam(creator_id: number, p1_id: number, p2_id: number) {
  const name = generateString(15);

  return await prisma.team.create({
    data: {
      team_name: name,
      creator_id: creator_id,
      founder_id1: p1_id,
      founder_id2: p2_id,
    },
  });
}

export async function createMatch(round_id: number | null, p1_id: number, p2_id: number, p1_won: boolean = true) {
  return await prisma.match.create({
    data: {
      round_id: round_id,
      player_pair1_score: p1_won ? 1002 : 450,
      player_pair2_score: p1_won ? 450 : 1002,
      player_pair_id1: p1_id,
      player_pair_id2: p2_id,
      score_threshold: 1001,
    },
  });
}
