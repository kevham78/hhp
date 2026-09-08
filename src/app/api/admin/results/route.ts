import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { getWeekendResults } from '@/lib/api/nhl'
import { z } from 'zod'

const confirmSchema = z.object({
  weekId: z.string(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const action = body.action as 'preview' | 'confirm'

    if (action === 'preview') return handlePreview(body)
    if (action === 'confirm') return handleConfirm(body)

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/results error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

async function handlePreview(body: any) {
  const { weekId } = body
  if (!weekId) {
    return NextResponse.json({ error: 'Missing weekId' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  const nhlResults = await getWeekendResults(
    new Date(week.saturdayDate),
    new Date(week.sundayDate)
  )

  const gameResults = week.games.map(game => {
    const nhlResult = nhlResults.find(r => r.nhlGameId === game.nhlGameId)
    const winner = nhlResult?.isFinal
      ? (nhlResult.homeScore > nhlResult.awayScore
          ? game.homeTeamCode
          : game.awayTeamCode)
      : null

    return {
      gameId:       game.id,
      nhlGameId:    game.nhlGameId,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      homeScore:    nhlResult?.homeScore ?? null,
      awayScore:    nhlResult?.awayScore ?? null,
      winner,
      isFinal:      nhlResult?.isFinal ?? false,
      isLive:       nhlResult?.isLive  ?? false,
    }
  })

  const allFinal   = gameResults.every(g => g.isFinal)
  const anyLive    = gameResults.some(g => g.isLive)
  const finalGames = gameResults.filter(g => g.isFinal)

  const playerResults = players.map(player => {
    const playerPicks = allPicks.filter(p => p.userId === player.id)
    let points        = 0

    const pickDetails = gameResults.map(result => {
      const pick    = playerPicks.find(p => p.gameId === result.gameId)
      const picked  = pick?.pickedTeam ?? null
      const correct = result.isFinal && picked === result.winner
      if (correct) points++

      return {
        gameId:         result.gameId,
        homeTeamCode:   result.homeTeamCode,
        awayTeamCode:   result.awayTeamCode,
        homeScore:      result.homeScore,
        awayScore:      result.awayScore,
        winner:         result.winner,
        isFinal:        result.isFinal,
        isLive:         result.isLive,
        pickedTeam:     picked,
        correct:        result.isFinal ? correct : null,
        tiebreakerRank: pick?.tiebreakerRank ?? null,
        autoPicked:     pick?.isAutoPickd ?? false,
      }
    })

    const winnerSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'WINNER'
    )
    const loserSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'LOSER'
    )

    const suicideWinnerCorrect = winnerSuicide && finalGames.length > 0
      ? finalGames.some(r => r.winner === winnerSuicide.pickedTeam)
      : null
    const suicideLoserCorrect = loserSuicide && finalGames.length > 0
      ? finalGames.some(r =>
          r.winner !== loserSuicide.pickedTeam &&
          (r.homeTeamCode === loserSuicide.pickedTeam ||
           r.awayTeamCode === loserSuicide.pickedTeam))
      : null

    return {
      userId: player.id,
      name:   player.name,
      points,
      pickDetails,
      suicideWinner: winnerSuicide
        ? { team: winnerSuicide.pickedTeam, correct: suicideWinnerCorrect }
        : null,
      suicideLoser: loserSuicide
        ? { team: loserSuicide.pickedTeam, correct: suicideLoserCorrect }
        : null,
    }
  }).sort((a, b) => b.points - a.points)

  const topPoints = playerResults[0]?.points ?? 0
  const tied      = playerResults.filter(p => p.points === topPoints)
  let weeklyWinner: any = null
  let isSplit           = false

  if (tied.length === 1) {
    weeklyWinner = tied[0]
  } else {
    const resolved = resolveTiebreaker(tied)
    if (resolved) {
      weeklyWinner = resolved
    } else {
      isSplit = true
    }
  }

  const splitAmount = isSplit
    ? settings.weeklyPrize / tied.length
    : settings.weeklyPrize

  return NextResponse.json({
    weekId,
    gameResults,
    playerResults,
    weeklyWinner:  isSplit ? null : weeklyWinner,
    isSplit,
    splitPlayers:  isSplit ? tied : [],
    topPoints,
    allFinal,
    anyLive,
    prizes: {
      totalCollected: players.length * settings.weeklyDues,
      weeklyPrize:    splitAmount,
      monthlyPot:     settings.monthlyPrize,
      suicideWinner:  settings.suicideWinnerPrize,
      suicideLoser:   settings.suicideLoserPrize,
    },
  })
}

function resolveTiebreaker(tiedPlayers: any[]): any | null {
  let remaining = [...tiedPlayers]
  for (const rank of [1, 2, 3]) {
    const withCorrect = remaining.filter(p => {
      const tb = p.pickDetails.find((d: any) => d.tiebreakerRank === rank)
      return tb?.correct === true
    })
    if (withCorrect.length === 1) return withCorrect[0]
    if (withCorrect.length > 1)  remaining = withCorrect
  }
  return null
}

async function handleConfirm(body: any) {
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const { weekId } = parsed.data

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

  const season = await prisma.season.findFirst({ where: { isActive: true } })
  if (!season) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 })
  }

  const nhlResults = await getWeekendResults(
    new Date(week.saturdayDate),
    new Date(week.sundayDate)
  )

  const gameResults = week.games.map(game => {
    const nhl    = nhlResults.find(r => r.nhlGameId === game.nhlGameId)
    const winner = nhl?.isFinal
      ? (nhl.homeScore > nhl.awayScore ? game.homeTeamCode : game.awayTeamCode)
      : null
    return {
      gameId:       game.id,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      homeScore:    nhl?.homeScore ?? 0,
      awayScore:    nhl?.awayScore ?? 0,
      winner,
      isFinal:      nhl?.isFinal ?? false,
    }
  })

  if (!gameResults.every(g => g.isFinal)) {
    return NextResponse.json(
      { error: 'Not all games are final yet' },
      { status: 400 }
    )
  }

  for (const result of gameResults) {
    await prisma.game.update({
      where: { id: result.gameId },
      data:  {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winner:    result.winner,
        status:    'FINAL',
      },
    })
  }

  const gameWinners: Record<string, string> = {}
  for (const r of gameResults) {
    if (r.winner) gameWinners[r.gameId] = r.winner
  }

  for (const pick of allPicks) {
    await prisma.pick.update({
      where: { id: pick.id },
      data:  {
        isCorrect: gameWinners[pick.gameId] === pick.pickedTeam,
        isDraft:   false,
      },
    })
  }

  const playerPoints: Record<string, number> = {}
  for (const player of players) {
    const picks  = allPicks.filter(p => p.userId === player.id)
    let points   = 0
    for (const pick of picks) {
      if (gameWinners[pick.gameId] === pick.pickedTeam) points++
    }
    playerPoints[player.id] = points
  }

  const sortedPlayers = players
    .map(p => ({
      userId: p.id,
      points: playerPoints[p.id] ?? 0,
      pickDetails: allPicks
        .filter(pick => pick.userId === p.id)
        .map(pick => ({
          gameId:         pick.gameId,
          correct:        gameWinners[pick.gameId] === pick.pickedTeam,
          tiebreakerRank: pick.tiebreakerRank,
        })),
    }))
    .sort((a, b) => b.points - a.points)

  const topPoints      = sortedPlayers[0]?.points ?? 0
  const tiedWithDetail = sortedPlayers.filter(p => p.points === topPoints)

  let winnerIds: string[] = []
  let isSplit             = false

  if (tiedWithDetail.length === 1) {
    winnerIds = [tiedWithDetail[0].userId]
  } else {
    const resolved = resolveTiebreaker(tiedWithDetail)
    if (resolved) {
      winnerIds = [resolved.userId]
    } else {
      isSplit   = true
      winnerIds = tiedWithDetail.map(p => p.userId)
    }
  }

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

  const prizeAmount = isSplit
    ? settings.weeklyPrize / winnerIds.length
    : settings.weeklyPrize

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

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
        createdBy:   adminUser?.id ?? winnerId,
      },
    })
  }

  for (const pick of suicidePicks) {
    const game = week.games.find(g =>
      g.homeTeamCode === pick.pickedTeam ||
      g.awayTeamCode === pick.pickedTeam
    )
    if (!game) continue

    const isCorrect = pick.poolType === 'WINNER'
      ? gameWinners[game.id] === pick.pickedTeam
      : gameWinners[game.id] !== pick.pickedTeam

    await prisma.suicidePick.update({
      where: { id: pick.id },
      data:  { isCorrect, isDraft: false },
    })
  }

  await prisma.week.update({
    where: { id: weekId },
    data:  { status: 'COMPLETED', picksPublished: true },
  })

  return NextResponse.json({ success: true, weekId })
}