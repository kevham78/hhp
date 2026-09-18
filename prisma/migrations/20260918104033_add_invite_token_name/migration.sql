-- AlterTable
-- Existing invite_tokens rows predate this column, so backfill them
-- with an empty string instead of failing outright on a non-empty
-- table (which is what happened in production).
ALTER TABLE "invite_tokens" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';
