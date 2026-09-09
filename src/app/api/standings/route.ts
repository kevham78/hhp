import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
    })

    if (!season) {
      return NextResponse.json({ error: 'No active season' }, { status: 404 })
    }

    // Get all players
    const players = await prisma.user.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    })

    // Get season stats
    const seasonStats = await prisma.seasonStat.findMany({
      where: { seasonId: season.id },
    })

    // Get all completed weeks
    const weeks = await prisma.week.findMany({
      where:   { seasonId: season.id, status: 'COMPLETED' },
      orderBy: { weekNumber: 'asc' },
    })

    // Get weekly stats for all completed weeks
    const weeklyStats = await prisma.weeklyStat.findMany({
      where: {
        weekId: { in: weeks.map(w => w.id) },
      },
    })

    // Get monthly results
    const monthlyResults = await prisma.monthlyResult.findMany({
      where:   { seasonId: season.id },
      orderBy: { year: 'asc' },
    })

    // Build standings
    const standings = players.map(player => {
      const stat = seasonStats.find(s => s.userId === player.id)

      // Weekly results for this player
      const playerWeekly = weeks.map(week => {
        const ws = weeklyStats.find(
          s => s.userId === player.id && s.weekId === week.id
        )
        return {
          weekId:     week.id,
          weekNumber: week.weekNumber,
          satDate:    week.saturdayDate,
          points:     ws?.points     ?? 0,
          isWinner:   ws?.isWinner   ?? false,
          isTied:     ws?.isTied     ?? false,
        }
      })

      // Monthly wins
      const playerMonthly = monthlyResults.filter(
        r => r.userId === player.id && r.isWinner
      )

      return {
        userId:       player.id,
        name:         player.name,
        image:        player.image,
        totalPoints:  stat?.totalPoints ?? 0,
        weeklyWins:   stat?.weeklyWins  ?? 0,
        monthlyWins:  playerMonthly.length,
        weeklyResults: playerWeekly,
      }
    }).sort((a, b) => b.totalPoints - a.totalPoints)

    // Weekly summary for history table
    const weekHistory = weeks.map(week => {
      const weekStats = weeklyStats.filter(s => s.weekId === week.id)
      const winners   = weekStats.filter(s => s.isWinner)
      const winnerNames = winners.map(w => {
        const player = players.find(p => p.id === w.userId)
        return player?.name ?? ''
      })

      return {
        weekId:      week.id,
        weekNumber:  week.weekNumber,
        satDate:     week.saturdayDate,
        sunDate:     week.sundayDate,
        topPoints:   weekStats.reduce((max, s) => Math.max(max, s.points), 0),
        winnerNames,
        isSplit:     winners.length > 1,
      }
    })

    return NextResponse.json({
      seasonName: season.name,
      standings,
      weekHistory,
      totalWeeks: weeks.length,
    })
  } catch (err) {
    console.error('GET /api/standings error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}