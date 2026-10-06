-- Winner suicide pool now knocks players out on their 2nd strike (was 1).
-- Reinstate anyone in the active season who was knocked out on a single strike.
UPDATE "suicide_status" SET "winnerPoolEliminated" = false
WHERE "winnerPoolEliminated" = true
  AND "winnerPoolStrikes" = 1
  AND "seasonId" IN (SELECT "id" FROM "seasons" WHERE "isActive" = true);

-- My Picks used to require both suicide picks even from players already out
-- of a pool. Results never grade those (isCorrect stays null), so remove them
-- rather than show them. Runs after the reinstatement above, so reinstated
-- winner-pool players keep their picks. Graded picks are never touched.
DELETE FROM "suicide_picks" sp
USING "suicide_status" ss, "weeks" w
WHERE sp."isCorrect" IS NULL
  AND w."id" = sp."weekId"
  AND ss."userId" = sp."userId"
  AND ss."seasonId" = w."seasonId"
  AND w."seasonId" IN (SELECT "id" FROM "seasons" WHERE "isActive" = true)
  AND (
    (sp."poolType" = 'WINNER' AND ss."winnerPoolEliminated") OR
    (sp."poolType" = 'LOSER'  AND ss."loserPoolEliminated")
  );
