-- Payments belong to a season, so a player's dues balance starts fresh
-- each season. Nullable column + backfill: no existing rows are removed.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "seasonId" TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: payments tied to a week (winnings) take that week's season
UPDATE "payments" p
SET "seasonId" = w."seasonId"
FROM "weeks" w
WHERE p."weekId" = w."id";

-- Backfill: other payments (dues paid to the commissioner) go to the first
-- season that hadn't ended yet when the payment was logged
UPDATE "payments" p
SET "seasonId" = (
  SELECT s."id" FROM "seasons" s
  WHERE s."endDate" >= p."createdAt"
  ORDER BY s."endDate" ASC
  LIMIT 1
)
WHERE p."seasonId" IS NULL;

-- Anything logged after every season ended: the most recent season
UPDATE "payments" p
SET "seasonId" = (SELECT s."id" FROM "seasons" s ORDER BY s."startDate" DESC LIMIT 1)
WHERE p."seasonId" IS NULL;
