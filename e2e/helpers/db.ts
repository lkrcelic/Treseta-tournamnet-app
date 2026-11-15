// The section's own database (never Neon, never production): setup, time shifts and asserts.
import {PrismaClient} from "@prisma/client";

export type Db = PrismaClient;

export function openDb(url: string): Db {
  return new PrismaClient({datasources: {db: {url}}});
}

// Time never passes for real in a test: shift the stored moments instead (published_at, ends_at, …)
export const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
export const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000);

// The cron route runs what is due (tournament clocks, closing tables); app.sh starts the server with this secret
export const CRON_HEADERS = {Authorization: "Bearer e2e-cron"};
