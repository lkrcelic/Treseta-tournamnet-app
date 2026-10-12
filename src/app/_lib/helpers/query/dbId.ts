// Whether a number can be a row id: ids are Postgres integers (int4), and Prisma throws on anything beyond that, so an
// id from a URL is checked first and answers "doesn't exist" (404) instead of a server error. Framework free.

const MAX_INT4 = 2_147_483_647;

export function isDbId(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_INT4;
}
