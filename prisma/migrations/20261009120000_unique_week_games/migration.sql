-- Remove duplicate games (the same NHL game stored twice in one week) and
-- stop it happening again. Week 2 got duplicates from a race between week
-- creation and "add games the NHL added later" (fixed in the app).
--
-- For each duplicated game, keep the copy with the most picks; move picks
-- from the extra copies onto it, keeping one pick per player per game.

-- Extra copies -> the copy being kept
CREATE TEMP TABLE "_game_keepers" AS
SELECT g."id" AS "game_id", k."keeper_id"
FROM "games" g
JOIN LATERAL (
  SELECT g2."id" AS "keeper_id"
  FROM "games" g2
  WHERE g2."weekId" = g."weekId" AND g2."nhlGameId" = g."nhlGameId"
  ORDER BY (SELECT count(*) FROM "picks" p WHERE p."gameId" = g2."id") DESC, g2."id"
  LIMIT 1
) k ON true
WHERE g."id" <> k."keeper_id";

-- Carry a tiebreaker rank over to the player's pick on the kept copy
UPDATE "picks" kp
SET "tiebreakerRank" = dp."tiebreakerRank"
FROM "picks" dp
JOIN "_game_keepers" gk ON gk."game_id" = dp."gameId"
WHERE kp."gameId" = gk."keeper_id"
  AND kp."userId" = dp."userId"
  AND dp."tiebreakerRank" IS NOT NULL
  AND kp."tiebreakerRank" IS NULL;

-- Drop a player's extra-copy pick when they already have a pick for that game
-- (on the kept copy, or on an earlier extra copy)
DELETE FROM "picks" dp
USING "_game_keepers" gk
WHERE dp."gameId" = gk."game_id"
  AND EXISTS (
    SELECT 1
    FROM "picks" o
    LEFT JOIN "_game_keepers" ok ON ok."game_id" = o."gameId"
    WHERE o."userId" = dp."userId"
      AND o."id" <> dp."id"
      AND COALESCE(ok."keeper_id", o."gameId") = gk."keeper_id"
      AND (ok."game_id" IS NULL OR o."id" < dp."id")
  );

-- Any remaining extra-copy picks move to the kept copy
UPDATE "picks" dp
SET "gameId" = gk."keeper_id"
FROM "_game_keepers" gk
WHERE dp."gameId" = gk."game_id";

-- Remove the extra copies
DELETE FROM "games" g
USING "_game_keepers" gk
WHERE g."id" = gk."game_id";

DROP TABLE "_game_keepers";

-- CreateIndex
CREATE UNIQUE INDEX "games_weekId_nhlGameId_key" ON "games"("weekId", "nhlGameId");
