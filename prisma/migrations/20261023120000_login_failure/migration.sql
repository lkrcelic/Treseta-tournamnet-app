-- Failed logins per account, whatever address they come from, in the database so every serverless instance sees the
-- same count (the per-address limit in loginLimiting.ts is in memory). The key is "player:<id>", or "login:<name>" for
-- a name with no account, so a missing account is locked the same way as a real one.
CREATE TABLE "LoginFailure" (
    "key"           VARCHAR(200) NOT NULL,
    "count"         INTEGER NOT NULL,
    "first_failure" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginFailure_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "LoginFailure_first_failure_idx" ON "LoginFailure"("first_failure");
