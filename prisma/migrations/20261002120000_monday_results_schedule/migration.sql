-- Monday schedule: commissioner "results ready to review" email at 5am,
-- results auto-approve at 9am (Eastern).
UPDATE "settings" SET "resultsEmailTime" = '05:00', "autoApproveTime" = '09:00';

-- AlterTable
ALTER TABLE "settings" ALTER COLUMN "resultsEmailTime" SET DEFAULT '05:00',
ALTER COLUMN "autoApproveTime" SET DEFAULT '09:00';
