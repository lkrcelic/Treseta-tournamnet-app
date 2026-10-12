// Prisma turns `equals` with mode "insensitive" into ILIKE on Postgres without escaping the value, so "_" and "%" in
// it match any character ("Liga 25_26" would match "Liga 25/26"). anyCase(value) is a Prisma string filter that
// matches the same text in any case, and nothing else. Framework free so it can be unit tested.

// The value with the LIKE wildcards (and the escape character itself) escaped
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function anyCase(value: string): {equals: string; mode: "insensitive"} {
  return {equals: escapeLike(value), mode: "insensitive"};
}
