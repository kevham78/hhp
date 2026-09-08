import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

const scoresSchema = z.object({
  weekId: z.string(),
  scores: z.array(z.object({
    gameId:    z.string(),
    homeScore: z.number().min(0),
    awayScore: z.number().min(0),
  })),
})

const confirmSchema = z.object({
  weekId: z.string(),
})

// ─────────────────────────────────────────────
// POST /api/admin/results
// Two actions: preview and confirm
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const action = body.action as 'preview' | 'confirm'

    if (action === 'preview') {
      return handlePreview(body)
    } else if (action === 'confirm') {
      return handleConfirm(body)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/results error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// PREVIEW — calculate results without saving
// ─────────────────────────────────────────────

async function handlePreview(body: any) {
  const parsed = scoresSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scores data' }, { status: 400 })
  }

  const { weekId, scores } = parsed.data

  // Load week, games, all picks, settings
  const [week, settings, allPicks, suicidePicks, players] = await Promise.all([
    prisma.week.findUnique({
      where:   { id: weekId },
      include: { games: true },
    }),
    prisma.settings.findFirst({ where: { id: 'default' } }),
    prisma.pick.findMany({
      where:   { weekId },
      include: { user: true },
    }),
    prisma.suicidePick.findMany({
      where:   { weekId },
      include: { user: true },
    }),
    prisma.user.findMany({ where: { isActive: true } }),
  ])

  if (!week || !settings) {
    return NextResponse.json({ error: 'Week or settings not found' }, { status: 404 })
  }

  // ── Determine winners for each game ────────
  const gameResults = scores.map(score => {
    const game   = week.games.find(g => g.id === score.gameId)
    if (!game) return null

    const homeWon = score.homeScore > score.awayScore
    const winner  = homeWon ? game.homeTeamCode : game.awayTeamCode

    return {
      gameId:       game.id,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      homeScore:    score.homeScore,
      awayScore:    score.awayScore,
      winner,
    }
  }).filter(Boolean) as any[]

  // ── Calculate each player's results ────────
  const playerResults = players.map(player => {
    const playerPicks = allPicks.filter(p => p.userId === player.id)

    let points        = 0
    const pickDetails = gameResults.map(result => {
      const pick      = playerPicks.find(p => p.gameId === result.gameId)
      const picked    = pick?.pickedTeam ?? null
      const correct   = picked === result.winner
      if (correct) points++

      return {
        gameId:         result.gameId,
        homeTeamCode:   result.homeTeamCode,
        awayTeamCode:   result.awayTeamCode,
        homeScore:      result.homeScore,
        awayScore:      result.awayScore,
        winner:         result.winner,
        pickedTeam:     picked,
        correct,
        tiebreakerRank: pick?.tiebreakerRank ?? null,
        autoPicked:     pick?.isAutoPickd ?? false,
      }
    })

    // Suicide pick results
    const winnerSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'WINNER'
    )
    const loserSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'LOSER'
    )

    const suicideWinnerCorrect = winnerSuicide
      ? gameResults.some(r => r.winner === winnerSuicide.pickedTeam)
      : null
    const suicideLoserCorrect = loserSuicide
      ? gameResults.some(r => r.winner !== loserSuicide.pickedTeam &&
          (r.homeTeamCode === loserSuicide.pickedTeam || r.awayTeamCode === loserSuicide.pickedTeam))
      : null

    return {
      userId:      player.id,
      name:        player.name,
      points,
      pickDetails,
      suicideWinner: winnerSuicide ? {
        team:    winnerSuicide.pickedTeam,
        correct: suicideWinnerCorrect,
      } : null,
      suicideLoser: loserSuicide ? {
        team:    loserSuicide.pickedTeam,
        correct: suicideLoserCorrect,
      } : null,
    }
  })

  // ── Determine weekly winner ─────────────────
  const sorted = [...playerResults].sort((a, b) => b.points - a.points)
  const topPoints = sorted[0]?.points ?? 0
  const tied = sorted.filter(p => p.points === topPoints)

  let weeklyWinner: any = null
  let isSplit           = false

  if (tied.length === 1) {
    weeklyWinner = tied[0]
  } else {
    // Tiebreaker logic
    const resolved = resolveTiebreaker(tied, gameResults)
    if (resolved) {
      weeklyWinner = resolved
    } else {
      isSplit = true
    }
  }

  // ── Prize breakdown ─────────────────────────
  const numPlayers    = players.length
  const totalCollected = numPlayers * settings.weeklyDues
  const weeklyPrize   = settings.weeklyPrize
  const monthlyPot    = settings.monthlyPrize
  const suicideWinner = settings.suicideWinnerPrize
  const suicideLoser  = settings.suicideLoserPrize

  const splitAmount = isSplit
    ? weeklyPrize / tied.length
    : weeklyPrize

  return NextResponse.json({
    weekId,
    gameResults,
    playerResults: sorted,
    weeklyWinner:  isSplit ? null : weeklyWinner,
    isSplit,
    splitPlayers:  isSplit ? tied : [],
    topPoints,
    prizes: {
      totalCollected,
      weeklyPrize:   isSplit ? splitAmount : weeklyPrize,
      monthlyPot,
      suicideWinner,
      suicideLoser,
    },
  })
}

// ─────────────────────────────────────────────
// Tiebreaker resolution
// ─────────────────────────────────────────────

function resolveTiebreaker(
  tiedPlayers: any[],
  gameResults: any[]
): any | null {
  // Try ranks 1, 2, 3 in order
  for (const rank of [1, 2, 3]) {
    const withRank = tiedPlayers.filter(p => {
      const tbPick = p.pickDetails.find((d: any) => d.tiebreakerRank === rank)
      return tbPick && tbPick.correct
    })

    if (withRank.length === 1) return withRank[0]
    if (withRank.length > 1) {
      // Still tied on this rank — continue to next rank
      // but only among players who got this rank correct
      // If no one got it right, move to next rank with all players
      if (withRank.length < tiedPlayers.length) {
        tiedPlayers = withRank
      }
    }
  }

  return null // still tied after all 3 tiebreakers
}

// ─────────────────────────────────────────────
// CONFIRM — save results to database
// ─────────────────────────────────────────────

async function handleConfirm(body: any) {
  const parsed = scoresSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const { weekId, scores } = parsed.data

  const [week, settings, allPicks, suicidePicks, players] = await Promise.all([
    prisma.week.findUnique({
      where:   { id: weekId },
      include: { games: true },
    }),
    prisma.settings.findFirst({ where: { id: 'default' } }),
    prisma.pick.findMany({ where: { weekId } }),
    prisma.suicidePick.findMany({ where: { weekId } }),
    prisma.user.findMany({ where: { isActive: true } }),
  ])

  if (!week || !settings) {
    return NextResponse.json({ error: 'Week or settings not found' }, { status: 404 })
  }

  // Get active season
  const season = await prisma.season.findFirst({ where: { isActive: true } })
  if (!season) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 })
  }

  // ── Update game scores and winners ─────────
  for (const score of scores) {
    const game   = week.games.find(g => g.id === score.gameId)
    if (!game) continue

    const winner = score.homeScore > score.awayScore
      ? game.homeTeamCode
      : game.awayTeamCode

    await prisma.game.update({
      where: { id: score.gameId },
      data:  {
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        winner,
        status: 'FINAL',
      },
    })
  }

  // ── Mark picks correct/incorrect ───────────
  const gameWinners: Record<string, string> = {}
  for (const score of scores) {
    const game = week.games.find(g => g.id === score.gameId)
    if (!game) continue
    gameWinners[score.gameId] = score.homeScore > score.awayScore
      ? game.homeTeamCode
      : game.awayTeamCode
  }

  for (const pick of allPicks) {
    const winner    = gameWinners[pick.gameId]
    const isCorrect = pick.pickedTeam === winner
    await prisma.pick.update({
      where: { id: pick.id },
      data:  { isCorrect, isDraft: false },
    })
  }

  // ── Calculate points per player ────────────
  const playerPoints: Record<string, number> = {}
  for (const player of players) {
    const playerPicks = allPicks.filter(p => p.userId === player.id)
    let points = 0
    for (const pick of playerPicks) {
      if (gameWinners[pick.gameId] === pick.pickedTeam) points++
    }
    playerPoints[player.id] = points
  }

  // ── Determine weekly winner ─────────────────
  const sorted    = Object.entries(playerPoints).sort((a, b) => b[1] - a[1])
  const topPoints = sorted[0]?.[1] ?? 0
  const tied      = sorted.filter(([, pts]) => pts === topPoints)

  // Build player results for tiebreaker
  const playerResults = players.map(player => {
    const picks = allPicks.filter(p => p.userId === player.id)
    const pickDetails = picks.map(pick => ({
      gameId:         pick.gameId,
      correct:        gameWinners[pick.gameId] === pick.pickedTeam,
      tiebreakerRank: pick.tiebreakerRank,
    }))
    return { userId: player.id, points: playerPoints[player.id] ?? 0, pickDetails }
  })

  const tiedResults = playerResults.filter(p => p.points === topPoints)
  let winnerIds: string[] = []
  let isSplit             = false

  if (tiedResults.length === 1) {
    winnerIds = [tiedResults[0].userId]
  } else {
    const resolved = resolveTiebreaker(tiedResults, [])
    if (resolved) {
      winnerIds = [resolved.userId]
    } else {
      isSplit   = true
      winnerIds = tiedResults.map(p => p.userId)
    }
  }

  // ── Save weekly stats ──────────────────────
  for (const player of players) {
    const points   = playerPoints[player.id] ?? 0
    const isWinner = winnerIds.includes(player.id)

    await prisma.weeklyStat.upsert({
      where:  { userId_weekId: { userId: player.id, weekId } },
      update: { points, correctPicks: points, isWinner, isTied: isSplit },
      create: {
        userId:       player.id,
        weekId,
        seasonId:     season.id,
        points,
        totalPicks:   week.games.length,
        correctPicks: points,
        isWinner,
        isTied:       isSplit,
      },
    })

    // Update season stats
    await prisma.seasonStat.upsert({
      where:  { userId_seasonId: { userId: player.id, seasonId: season.id } },
      update: {
        totalPoints:   { increment: points },
        weeklyWins:    { increment: isWinner ? 1 : 0 },
        monthlyPoints: { increment: points },
      },
      create: {
        userId:        player.id,
        seasonId:      season.id,
        totalPoints:   points,
        weeklyWins:    isWinner ? 1 : 0,
        monthlyPoints: points,
      },
    })
  }

  // ── Log prize payments ─────────────────────
  const prizeAmount = isSplit
    ? settings.weeklyPrize / winnerIds.length
    : settings.weeklyPrize

  for (const winnerId of winnerIds) {
    await prisma.payment.create({
      data: {
        playerId:    winnerId,
        weekId,
        type:        'WEEKLY_WINNING',
        amount:      prizeAmount,
        description: isSplit
          ? `Week ${week.weekNumber} prize (split ${winnerIds.length} ways)`
          : `Week ${week.weekNumber} winner`,
        recipientId: winnerId,
        createdBy:   winnerId, // will be replaced with admin ID
      },
    })
  }

  // ── Update suicide picks correct/incorrect ─
  for (const pick of suicidePicks) {
    const game = week.games.find(g =>
      g.homeTeamCode === pick.pickedTeam || g.awayTeamCode === pick.pickedTeam
    )
    if (!game) continue

    let isCorrect = false
    if (pick.poolType === 'WINNER') {
      isCorrect = gameWinners[game.id] === pick.pickedTeam
    } else {
      isCorrect = gameWinners[game.id] !== pick.pickedTeam
    }

    await prisma.suicidePick.update({
      where: { id: pick.id },
      data:  { isCorrect, isDraft: false },
    })
  }

  // ── Mark week as completed ─────────────────
  await prisma.week.update({
    where: { id: weekId },
    data:  { status: 'COMPLETED', picksPublished: true },
  })

  return NextResponse.json({ success: true, weekId })
}