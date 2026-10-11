// Replays every player's rating from the rated rounds, the same way an admin edit does (replayRatings).
// Run once after a deploy that changes how ratings are computed, with the target database in DATABASE_URL:
//   DATABASE_URL="postgresql://…" npm run ratings:replay            (shows what would change, writes nothing)
//   DATABASE_URL="postgresql://…" npm run ratings:replay -- --apply (writes the new ratings)
import {lockRatings, replayRatings} from "@/app/_lib/service/admin/recalc";
import {prisma} from "@/app/_lib/prisma";

const apply = process.argv.includes("--apply");

// thrown to roll the transaction back on a dry run (a plain value: the scripts compile to ES5, where instanceof
// doesn't work on Error subclasses)
const DRY_RUN = {dryRun: true};

(async () => {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "") || "(DATABASE_URL from .env)";
  console.log(`database: ${host}${apply ? "" : "  (dry run, nothing is written)"}`);

  const select = {id: true, username: true, rating: true} as const;
  const before = new Map((await prisma.player.findMany({select})).map((p) => [p.id, p]));
  let changed: {player: string; before: number; after: number}[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        await lockRatings(tx);
        await replayRatings(tx);
        const after = await tx.player.findMany({select});
        changed = after
          .map((a) => ({player: a.username, before: Math.round(Number(before.get(a.id)?.rating)), after: Math.round(Number(a.rating))}))
          .filter((c) => c.before !== c.after);
        if (!apply) throw DRY_RUN;
      },
      {timeout: 120_000}
    );
  } catch (e) {
    if (e !== DRY_RUN) throw e;
  }

  const diffs = changed.map((c) => Math.abs(c.after - c.before)).sort((a, b) => a - b);
  console.log(`players: ${before.size}, ratings that ${apply ? "changed" : "would change"}: ${changed.length}` + (diffs.length ? ` (median ${diffs[Math.floor(diffs.length / 2)]}, largest ${diffs[diffs.length - 1]})` : ""));
  console.table(changed.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 10));
  if (!apply && changed.length) console.log("Run again with --apply to write them.");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
