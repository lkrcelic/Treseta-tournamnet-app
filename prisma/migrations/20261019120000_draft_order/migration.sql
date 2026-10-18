-- A round waiting in Skica has no number for the admin: it is Skica A, B, C… by its place in the batch Novo kolo
-- created, and it is numbered after the league's last published round when it is published (so publishing only the
-- last of three drafts leaves no gap). Its round_number only keeps its tables together until then.
ALTER TABLE "Round" ADD COLUMN "draft_order" INTEGER;

-- the drafts waiting now: their place among their night's rounds not published yet
UPDATE "Round" r
SET draft_order = w.k
FROM (SELECT r2.id,
             DENSE_RANK() OVER (PARTITION BY lr.league_id, r2.round_date ORDER BY r2.round_number) AS k
      FROM "Round" r2
               JOIN "LeagueRound" lr ON lr.round_id = r2.id
      WHERE r2.status <> 'PUBLISHED'
        AND r2.round_number IS NOT NULL) w
WHERE r.id = w.id;

-- only a round not published yet has a draft order
ALTER TABLE "Round" ADD CONSTRAINT "Round_draft_order_check" CHECK (draft_order IS NULL OR status <> 'PUBLISHED');
