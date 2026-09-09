import { prisma } from '@/lib/db/prisma'

// ─────────────────────────────────────────────
// Auto-pick for players who haven't submitted
// Called at Friday 2pm deadline
// ─────────────────────────────────────────────

export async function runAutoPick(weekId: string) {
  console.log(`[AutoPick] Running for week ${weekId}`)

  const week = await prisma.week.findUnique({
    where:   { id: weekId },
    include: { games: true },
  })

  if (!week) {
    console.error('[AutoPick] Week not found')
    return
  }

  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })

  if (!season) {
    console.error('[AutoPick] No active season')
    return
  }

  // Get all active players
  const players = await prisma.user.findMany({
    where: { isActive: true },
  })

  // Get players who have already submitted
  const submitted = await prisma.pick.findMany({
    where:    { weekId, isDraft: false },
    distinct: ['userId'],
    select:   { userId: true },
  })

  const submittedIds = new Set(submitted.map(p => p.userId))
  const pending      = players.filter(p => !submittedIds.has(p.id))

  console.log(`[AutoPick] ${pending.length} players need auto-picks`)

  for (const player of pending) {
    await autoPickForPlayer(player.id, week, season.id)
  }

  // Publish picks for everyone
  await prisma.week.update({
    where: { id: weekId },
    data:  { picksPublished: true, status: 'LOCKED' },
  })

  console.log(`[AutoPick] Complete — picks published for week ${weekId}`)
}

async function autoPickForPlayer(
  userId:   string,
  week:     any,
  seasonId: string
) {
  console.log(`[AutoPick] Auto-picking for user ${userId}`)

  // Get existing draft picks
  const existingPicks = await prisma.pick.findMany({
    where: { userId, weekId: week.id },
  })

  const existingGameIds = new Set(existingPicks.map(p => p.gameId))

  // Get suicide status for team restrictions
  const suicideStatus = await prisma.suicideStatus.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
  })

  const winnerTeamsUsed = suicideStatus?.winnerTeamsUsed ?? []
  const loserTeamsUsed  = suicideStatus?.loserTeamsUsed  ?? []

  // ── Auto-pick Phase 1: Missing games ────────
  const newPicks: { gameId: string; pickedTeam: string }[] = []

  for (const game of week.games) {
    if (existingGameIds.has(game.id)) continue

    // Randomly pick home or away
    const pickHome   = Math.random() > 0.5
    const pickedTeam = pickHome ? game.homeTeamCode : game.awayTeamCode

    await prisma.pick.upsert({
      where: {
        userId_weekId_gameId: { userId, weekId: week.id, gameId: game.id },
      },
      update: {
        pickedTeam,
        isAutoPickd: true,
        isDraft:     false,
        submittedAt: new Date(),
      },
      create: {
        userId,
        weekId:      week.id,
        gameId:      game.id,
        pickedTeam,
        isAutoPickd: true,
        isDraft:     false,
        submittedAt: new Date(),
      },
    })

    newPicks.push({ gameId: game.id, pickedTeam })
  }

  // Submit any existing draft picks
  if (existingPicks.length > 0) {
    await prisma.pick.updateMany({
      where: { userId, weekId: week.id, isDraft: true },
      data:  { isDraft: false, submittedAt: new Date() },
    })
  }

  // Get all picks after auto-pick (for tiebreaker + suicide)
  const allPicks = await prisma.pick.findMany({
    where: { userId, weekId: week.id },
  })

  // ── Auto-pick Phase 2: Tiebreakers ──────────
  const hasTiebreakers = allPicks.filter(p => p.tiebreakerRank).length === 3
  if (!hasTiebreakers) {
    // Clear existing tiebreakers
    await prisma.pick.updateMany({
      where: { userId, weekId: week.id },
      data:  { tiebreakerRank: null },
    })

    // Pick 3 random picks as tiebreakers
    const shuffled = [...allPicks].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      await prisma.pick.update({
        where: { id: shuffled[i].id },
        data:  { tiebreakerRank: i + 1 },
      })
    }
  }

  // ── Auto-pick Phase 3: Suicide ───────────────
  const existingSuicide = await prisma.suicidePick.findMany({
    where: { userId, weekId: week.id },
  })

  const hasWinnerSuicide = existingSuicide.some(s => s.poolType === 'WINNER')
  const hasLoserSuicide  = existingSuicide.some(s => s.poolType === 'LOSER')

  // Check if player is still in each pool
  const isInWinnerPool = !(suicideStatus?.winnerPoolEliminated ?? false)
  const isInLoserPool  = !(suicideStatus?.loserPoolEliminated  ?? false)

  if (isInWinnerPool && !hasWinnerSuicide) {
    // Pick a random winner that hasn't been used before
    const available = allPicks.filter(
      p => !winnerTeamsUsed.includes(p.pickedTeam)
    )
    const pick = available[Math.floor(Math.random() * available.length)]

    if (pick) {
      await prisma.suicidePick.upsert({
        where: {
          userId_weekId_poolType: {
            userId,
            weekId:   week.id,
            poolType: 'WINNER',
          },
        },
        update: {
          pickedTeam:  pick.pickedTeam,
          isAutoPicked: true,
          isDraft:     false,
          submittedAt: new Date(),
        },
        create: {
          userId,
          weekId:      week.id,
          poolType:    'WINNER',
          pickedTeam:  pick.pickedTeam,
          isAutoPicked: true,
          isDraft:     false,
          submittedAt: new Date(),
        },
      })
    }
  }

  if (isInLoserPool && !hasLoserSuicide) {
    // For loser pool — pick opponent of a random pick
    // that hasn't been used in the loser pool before
    const available = allPicks
      .map(pick => {
        const game    = week.games.find((g: any) => g.id === pick.gameId)
        if (!game) return null
        const opponent = pick.pickedTeam === game.homeTeamCode
          ? game.awayTeamCode
          : game.homeTeamCode
        return { pick, opponent }
      })
      .filter(Boolean)
      .filter(p => !loserTeamsUsed.includes(p!.opponent)) as any[]

    const selected = available[Math.floor(Math.random() * available.length)]

    if (selected) {
      await prisma.suicidePick.upsert({
        where: {
          userId_weekId_poolType: {
            userId,
            weekId:   week.id,
            poolType: 'LOSER',
          },
        },
        update: {
          pickedTeam:  selected.opponent,
          isAutoPicked: true,
          isDraft:     false,
          submittedAt: new Date(),
        },
        create: {
          userId,
          weekId:      week.id,
          poolType:    'LOSER',
          pickedTeam:  selected.opponent,
          isAutoPicked: true,
          isDraft:     false,
          submittedAt: new Date(),
        },
      })
    }
  }

  // Submit existing suicide drafts
  await prisma.suicidePick.updateMany({
    where: { userId, weekId: week.id, isDraft: true },
    data:  { isDraft: false, submittedAt: new Date() },
  })
}