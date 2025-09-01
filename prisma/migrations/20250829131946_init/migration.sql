-- CreateEnum
CREATE TYPE "RoleEnum" AS ENUM ('ADMIN', 'PLAYER');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "player_role" "RoleEnum" NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "birth_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3),
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "name" VARCHAR(100),

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT,
    "userId" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LuciaSession" (
    "id" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LuciaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "League" (
    "league_id" SERIAL NOT NULL,
    "league_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("league_id")
);

-- CreateTable
CREATE TABLE "Team" (
    "team_id" SERIAL NOT NULL,
    "team_name" VARCHAR(100) NOT NULL,
    "founder_id1" INTEGER,
    "founder_id2" INTEGER,
    "creator_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3),

    CONSTRAINT "Team_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "TeamScore" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "league_id" INTEGER,
    "rounds_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "point_difference" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "team_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,

    CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("team_id","player_id")
);

-- CreateTable
CREATE TABLE "LeagueTeam" (
    "league_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,

    CONSTRAINT "LeagueTeam_pkey" PRIMARY KEY ("league_id","team_id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" SERIAL NOT NULL,
    "round_number" INTEGER,
    "round_date" DATE DEFAULT CURRENT_TIMESTAMP,
    "team1_id" INTEGER NOT NULL,
    "team2_id" INTEGER NOT NULL,
    "team1_wins" INTEGER NOT NULL DEFAULT 0,
    "team2_wins" INTEGER NOT NULL DEFAULT 0,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "table_number" INTEGER,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueRound" (
    "league_id" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,

    CONSTRAINT "LeagueRound_pkey" PRIMARY KEY ("league_id","round_id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER,
    "team1_score" INTEGER NOT NULL DEFAULT 0,
    "team2_score" INTEGER NOT NULL DEFAULT 0,
    "team1_id" INTEGER,
    "team2_id" INTEGER,
    "score_threshold" INTEGER,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "match_date" DATE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OngoingMatch" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER,
    "team1_score" INTEGER NOT NULL DEFAULT 0,
    "team2_score" INTEGER NOT NULL DEFAULT 0,
    "team1_id" INTEGER,
    "team2_id" INTEGER,
    "score_threshold" INTEGER,
    "start_time" TIME DEFAULT CURRENT_TIME,
    "end_time" TIME,
    "match_date" DATE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OngoingMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "result_id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "team1_game_points" INTEGER NOT NULL DEFAULT 0,
    "team2_game_points" INTEGER NOT NULL DEFAULT 0,
    "complete_victory" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "OngoingResult" (
    "result_id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "team1_game_points" INTEGER NOT NULL DEFAULT 0,
    "team2_game_points" INTEGER NOT NULL DEFAULT 0,
    "complete_victory" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OngoingResult_pkey" PRIMARY KEY ("result_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Team_team_name_key" ON "Team"("team_name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamScore_team_id_league_id_key" ON "TeamScore"("team_id", "league_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LuciaSession" ADD CONSTRAINT "LuciaSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_founder_id1_fkey" FOREIGN KEY ("founder_id1") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_founder_id2_fkey" FOREIGN KEY ("founder_id2") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamScore" ADD CONSTRAINT "TeamScore_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamScore" ADD CONSTRAINT "TeamScore_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "Team"("team_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueRound" ADD CONSTRAINT "LeagueRound_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "League"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueRound" ADD CONSTRAINT "LeagueRound_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OngoingMatch" ADD CONSTRAINT "OngoingMatch_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OngoingResult" ADD CONSTRAINT "OngoingResult_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "OngoingMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
