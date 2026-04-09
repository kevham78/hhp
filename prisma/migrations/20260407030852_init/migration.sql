-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('UPCOMING', 'OPEN', 'LOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GameDay" AS ENUM ('SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'POSTPONED');

-- CreateEnum
CREATE TYPE "SuicidePool" AS ENUM ('WINNER', 'LOSER');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DUES_PAID', 'WEEKLY_WINNING', 'MONTHLY_WINNING', 'SUICIDE_WINNING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PICKS_REMINDER', 'PICKS_PUBLISHED', 'WEEK_RESULTS', 'PAYMENT_LOGGED', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "past_season_winners" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "winnerName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "past_season_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "saturdayDate" TIMESTAMP(3) NOT NULL,
    "sundayDate" TIMESTAMP(3) NOT NULL,
    "picksDeadline" TIMESTAMP(3) NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'UPCOMING',
    "isSkipped" BOOLEAN NOT NULL DEFAULT false,
    "picksPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "nhlGameId" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeTeamCode" TEXT NOT NULL,
    "awayTeamCode" TEXT NOT NULL,
    "gameTime" TIMESTAMP(3) NOT NULL,
    "gameDay" "GameDay" NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winner" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "pickedTeam" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "isAutoPickd" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tiebreakerRank" INTEGER,

    CONSTRAINT "picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suicide_status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "winnerPoolEliminated" BOOLEAN NOT NULL DEFAULT false,
    "winnerPoolStrikes" INTEGER NOT NULL DEFAULT 0,
    "loserPoolEliminated" BOOLEAN NOT NULL DEFAULT false,
    "loserPoolStrikes" INTEGER NOT NULL DEFAULT 0,
    "winnerTeamsUsed" TEXT[],
    "loserTeamsUsed" TEXT[],

    CONSTRAINT "suicide_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suicide_picks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "poolType" "SuicidePool" NOT NULL,
    "pickedTeam" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "isAutoPicked" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suicide_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suicide_pool_state" (
    "id" TEXT NOT NULL,
    "poolType" "SuicidePool" NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekId" TEXT,
    "currentPot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suicide_pool_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalPicks" INTEGER NOT NULL DEFAULT 0,
    "correctPicks" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "isTied" BOOLEAN NOT NULL DEFAULT false,
    "tiebreakerWon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "weekly_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "weeklyWins" INTEGER NOT NULL DEFAULT 0,
    "monthlyWins" INTEGER NOT NULL DEFAULT 0,
    "currentMonth" INTEGER,
    "monthlyPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "weekId" TEXT,
    "type" "PaymentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "recipientId" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "weeklyDues" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "weeklyPrize" DOUBLE PRECISION NOT NULL DEFAULT 30.00,
    "monthlyPrize" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "suicideWinnerPrize" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "suicideLoserPrize" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "resultsEmailDay" TEXT NOT NULL DEFAULT 'Monday',
    "resultsEmailTime" TEXT NOT NULL DEFAULT '09:00',
    "reminderOneDay" TEXT NOT NULL DEFAULT 'Thursday',
    "reminderOneTime" TEXT NOT NULL DEFAULT '15:00',
    "reminderTwoDay" TEXT NOT NULL DEFAULT 'Friday',
    "reminderTwoTime" TEXT NOT NULL DEFAULT '08:00',
    "picksRevealDay" TEXT NOT NULL DEFAULT 'Friday',
    "picksRevealTime" TEXT NOT NULL DEFAULT '14:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_key" ON "invite_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "past_season_winners_seasonId_key" ON "past_season_winners"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_seasonId_weekNumber_key" ON "weeks"("seasonId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "picks_userId_weekId_gameId_key" ON "picks"("userId", "weekId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "suicide_status_userId_seasonId_key" ON "suicide_status"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "suicide_picks_userId_weekId_poolType_key" ON "suicide_picks"("userId", "weekId", "poolType");

-- CreateIndex
CREATE UNIQUE INDEX "suicide_pool_state_poolType_seasonId_key" ON "suicide_pool_state"("poolType", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_stats_userId_weekId_key" ON "weekly_stats"("userId", "weekId");

-- CreateIndex
CREATE UNIQUE INDEX "season_stats_userId_seasonId_key" ON "season_stats"("userId", "seasonId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_season_winners" ADD CONSTRAINT "past_season_winners_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picks" ADD CONSTRAINT "picks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picks" ADD CONSTRAINT "picks_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picks" ADD CONSTRAINT "picks_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suicide_status" ADD CONSTRAINT "suicide_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suicide_status" ADD CONSTRAINT "suicide_status_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suicide_picks" ADD CONSTRAINT "suicide_picks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_stats" ADD CONSTRAINT "weekly_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_stats" ADD CONSTRAINT "weekly_stats_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
