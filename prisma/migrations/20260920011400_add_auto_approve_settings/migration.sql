-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "autoApproveDay" TEXT NOT NULL DEFAULT 'Monday',
ADD COLUMN     "autoApproveTime" TEXT NOT NULL DEFAULT '11:00';
