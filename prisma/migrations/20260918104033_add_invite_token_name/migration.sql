/*
  Warnings:

  - Added the required column `name` to the `invite_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invite_tokens" ADD COLUMN     "name" TEXT NOT NULL;
