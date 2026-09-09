import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const weekId = searchParams.get('weekId')

    if (!weekId) {
      return NextResponse.json({ error: 'Missing weekId' }, { status: 400 })
    }

    const week = await prisma.week.findUnique({
      where:   { id: weekId },
      include: { games: { orderBy: { gameTime: 'asc' } } },
    })

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 })
    }

    // Only show picks if published
    if (!week.picksPublished) {
      return NextResponse.json({
        published: false,
        weekId,
        weekNumber: week.weekNumber,
      })
    }

    // Get all players alphabetically
    const players = await prisma.user.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    })

    // Get all picks for this week
    const picks = await prisma.pick.findMany({
      where: { weekId },
    })

    // Get all suicide picks for this week
    const suicidePicks = await prisma.suicidePick.findMany({
      where: { weekId },
    })

    // Get weekly stats
    const weeklyStats = await prisma.weeklyStat.findMany({
      where: { weekId },
    })

    // Shape the data into a grid
    const playerData = players.map(player => {
      const playerPicks    = picks.filter(p => p.userId === player.id)
      const playerSuicide  = suicidePicks.filter(s => s.userId === player.id)
      const playerStat     = weeklyStats.find(s => s.userId === player.id)

      // Regular picks keyed by gameId
      const picksByGame: Record<string, {
        pickedTeam:     string
        isCorrect:      boolean | null
        tiebreakerRank: number | null
        autoPicked:     boolean
      }> = {}

      for (const pick of playerPicks) {
        picksByGame[pick.gameId] = {
          pickedTeam:     pick.pickedTeam,
          isCorrect:      pick.isCorrect,
          tiebreakerRank: pick.tiebreakerRank,
          autoPicked:     pick.isAutoPickd,
        }
      }

      // Tiebreakers in rank order
      const tiebreakers = [1, 2, 3].map(rank => {
        const pick = playerPicks.find(p => p.tiebreakerRank === rank)
        if (!pick) return null
        const game = week.games.find(g => g.id === pick.gameId)
        return {
          rank,
          pickedTeam: pick.pickedTeam,
          isCorrect:  pick.isCorrect,
          gameLabel:  game
            ? `${game.awayTeamCode} @ ${game.homeTeamCode}`
            : '',
        }
      })

      // Suicide picks
      const winnerPick = playerSuicide.find(s => s.poolType === 'WINNER')
      const loserPick  = playerSuicide.find(s => s.poolType === 'LOSER')

      return {
        userId:   player.id,
        name:     player.name,
        image:    player.image,
        picks:    picksByGame,
        tiebreakers,
        suicide: {
          winner: winnerPick
            ? { team: winnerPick.pickedTeam, isCorrect: winnerPick.isCorrect }
            : null,
          loser: loserPick
            ? { team: loserPick.pickedTeam, isCorrect: loserPick.isCorrect }
            : null,
        },
        points:   playerStat?.points ?? 0,
        isWinner: playerStat?.isWinner ?? false,
        isTied:   playerStat?.isTied ?? false,
      }
    })

    return NextResponse.json({
      published:  true,
      weekId,
      weekNumber: week.weekNumber,
      saturdayDate: week.saturdayDate,
      sundayDate:   week.sundayDate,
      games:      week.games,
      players:    playerData,
    })
  } catch (err) {
    console.error('GET /api/picks/week error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}