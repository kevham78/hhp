import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { monthKey } from '@/lib/months'
import { rankPlayers } from '@/lib/standings'

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

    // Prize money paid out this season (weekly, monthly and suicide) —
    // the same winnings the Money page shows
    const winnings = await prisma.payment.findMany({
      where: { type: { not: 'DUES_PAID' }, week: { seasonId: season.id } },
    })

    // Get monthly results
    const monthlyResults = await prisma.monthlyResult.findMany({
      where:   { seasonId: season.id },
      orderBy: { year: 'asc' },
    })

    // Completed weeks grouped by month, oldest first
    const monthWeeks = new Map<string, typeof weeks>()
    for (const week of weeks) {
      const key = monthKey(week.saturdayDate)
      monthWeeks.set(key, [...(monthWeeks.get(key) ?? []), week])
    }

    // Build standings
    const unranked = players.map(player => {
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

      // Points per month, from that month's weeks
      const playerMonths = [...monthWeeks.keys()].map(month => ({
        month,
        points: playerWeekly
          .filter(w => monthKey(w.satDate) === month)
          .reduce((sum, w) => sum + w.points, 0),
      }))

      return {
        userId:       player.id,
        name:         player.name,
        image:        player.image,
        moneyWon:     winnings.filter(p => p.recipientId === player.id).reduce((sum, p) => sum + p.amount, 0),
        totalPoints:  stat?.totalPoints ?? 0,
        weeklyWins:   stat?.weeklyWins  ?? 0,
        monthlyWins:  playerMonthly.length,
        weeklyResults: playerWeekly,
        monthlyPoints: playerMonths,
      }
    })

    const standings = rankPlayers(unranked)

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

    // Monthly summary. A month that's been closed (see closeFinishedMonths)
    // has recorded winners; until then its top scorers are only leading.
    const monthHistory = [...monthWeeks].map(([month, monthWeekList]) => {
      const [year, mon] = month.split('-').map(Number)
      const recorded  = monthlyResults.filter(r => r.year === year && r.month === mon)
      const totals    = standings.map(p => ({ userId: p.userId, name: p.name, points: p.monthlyPoints.find(m => m.month === month)!.points }))
      const topPoints = totals.reduce((max, t) => Math.max(max, t.points), 0)
      const leaders   = recorded.length > 0
        ? totals.filter(t => recorded.some(r => r.userId === t.userId && r.isWinner))
        : totals.filter(t => t.points === topPoints && topPoints > 0)
      return {
        month,
        weekCount:   monthWeekList.length,
        topPoints,
        leaderIds:   leaders.map(l => l.userId),
        leaderNames: leaders.map(l => l.name ?? ''),
        isTied:      leaders.length > 1,
        inProgress:  recorded.length === 0,
      }
    })

    return NextResponse.json({
      seasonName: season.name,
      standings,
      weekHistory,
      monthHistory,
      totalWeeks: weeks.length,
    })
  } catch (err) {
    console.error('GET /api/standings error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}