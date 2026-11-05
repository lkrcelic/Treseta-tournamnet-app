import {Prisma, PrismaClient} from "@prisma/client";

// Failed logins per account from any address: the per-address limit in loginLimiting.ts is in memory and per address, so
// a few addresses or serverless instances would each get fresh tries. Higher than that limit, so a player isn't locked
// out by someone else failing with their username unless it is a real attack.
export const ACCOUNT_MAX_FAILURES = 20;
export const ACCOUNT_WINDOW_DURATION = 15 * 60 * 1000; // Minutes * seconds * miliseconds

// New accounts per address: sign-up is open to anyone and hashes a password each time, so a script could make thousands
// of junk accounts. Generous, since a league night or a tournament can have many new players on the venue's wifi.
export const SIGNUP_MAX = 20;
export const SIGNUP_WINDOW_DURATION = 60 * 60 * 1000; // Minutes * seconds * miliseconds
const SIGNUP_PREFIX = "signup:";

const KEY_LENGTH = 200;

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

// Counts the attempt (before the password is checked, so parallel requests can't all get through) and says whether the
// account is locked. One statement, so it holds across instances.
export async function countAccountLogin(db: Db, key: string, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - ACCOUNT_WINDOW_DURATION);
  const [row] = await db.$queryRaw<{count: number}[]>(Prisma.sql`
    INSERT INTO "LoginFailure" ("key", "count", "first_failure")
    VALUES (${key.slice(0, KEY_LENGTH)}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginFailure"."first_failure" < ${cutoff} THEN 1 ELSE "LoginFailure"."count" + 1 END,
      "first_failure" = CASE WHEN "LoginFailure"."first_failure" < ${cutoff} THEN ${now} ELSE "LoginFailure"."first_failure" END
    RETURNING "count"`);
  // a new window: drop the rows whose window is over, so names tried once don't pile up (sign-up rows keep their own hour)
  if (row.count === 1) {
    await db.$executeRaw`DELETE FROM "LoginFailure" WHERE "first_failure" < ${cutoff} AND "key" NOT LIKE ${SIGNUP_PREFIX + "%"}`;
  }
  return row.count > ACCOUNT_MAX_FAILURES;
}

// A correct password clears the count, so a player logging in on several devices is never locked
export async function clearAccountLogins(db: Db, key: string): Promise<void> {
  await db.$executeRaw`DELETE FROM "LoginFailure" WHERE "key" = ${key.slice(0, KEY_LENGTH)}`;
}

// Counts a sign-up from this address and says whether it is over the limit. Same table and statement as the logins, so
// it holds across instances; counted before the password is hashed, so parallel requests can't all get through.
export async function countSignup(db: Db, ip: string, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - SIGNUP_WINDOW_DURATION);
  const [row] = await db.$queryRaw<{count: number}[]>(Prisma.sql`
    INSERT INTO "LoginFailure" ("key", "count", "first_failure")
    VALUES (${(SIGNUP_PREFIX + ip).slice(0, KEY_LENGTH)}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginFailure"."first_failure" < ${cutoff} THEN 1 ELSE "LoginFailure"."count" + 1 END,
      "first_failure" = CASE WHEN "LoginFailure"."first_failure" < ${cutoff} THEN ${now} ELSE "LoginFailure"."first_failure" END
    RETURNING "count"`);
  if (row.count === 1) {
    await db.$executeRaw`DELETE FROM "LoginFailure" WHERE "first_failure" < ${cutoff} AND "key" LIKE ${SIGNUP_PREFIX + "%"}`;
  }
  return row.count > SIGNUP_MAX;
}
