import {timingSafeEqual} from "crypto";

// /api/cron/tick's check: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` by itself, and another scheduler is
// set up to send the same header. Without CRON_SECRET set nobody may call it.
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
