import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

// ─────────────────────────────────────────────
// GET /api/suicide
// Every player's winner/loser suicide picks,
// week by week, for the active season.
// ─────────────────────────────────────────────

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

    // Only weeks that have been revealed — same rule as the Results page
    const weeks = await prisma.week.findMany({
      where:   { seasonId: season.id, picksPublished: true },
      orderBy: { weekNumber: 'asc' },
    })

    const players = await prisma.user.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    })

    const suicidePicks = await prisma.suicidePick.findMany({
      where: { weekId: { in: weeks.map(w => w.id) } },
    })

    const suicideStatus = await prisma.suicideStatus.findMany({
      where: { seasonId: season.id },
    })

    const suicidePools = await prisma.suicidePoolState.findMany({
      where: { seasonId: season.id },
    })

    const playerData = players.map(player => {
      const status = suicideStatus.find(s => s.userId === player.id)
      const picksByWeek: Record<string, {
        winner: { team: string; isCorrect: boolean | null } | null
        loser:  { team: string; isCorrect: boolean | null } | null
      }> = {}

      for (const week of weeks) {
        const winnerPick = suicidePicks.find(
          p => p.userId === player.id && p.weekId === week.id && p.poolType === 'WINNER'
        )
        const loserPick = suicidePicks.find(
          p => p.userId === player.id && p.weekId === week.id && p.poolType === 'LOSER'
        )
        picksByWeek[week.id] = {
          winner: winnerPick ? { team: winnerPick.pickedTeam, isCorrect: winnerPick.isCorrect } : null,
          loser:  loserPick  ? { team: loserPick.pickedTeam,  isCorrect: loserPick.isCorrect }  : null,
        }
      }

      return {
        userId:           player.id,
        name:             player.name,
        image:            player.image,
        winnerEliminated: status?.winnerPoolEliminated ?? false,
        winnerStrikes:    status?.winnerPoolStrikes     ?? 0,
        loserEliminated:  status?.loserPoolEliminated   ?? false,
        loserStrikes:     status?.loserPoolStrikes      ?? 0,
        picks:            picksByWeek,
      }
    })

    return NextResponse.json({
      weeks: weeks.map(w => ({ weekId: w.id, weekNumber: w.weekNumber })),
      players: playerData,
      pots: {
        winner: suicidePools.find(p => p.poolType === 'WINNER')?.currentPot ?? 0,
        loser:  suicidePools.find(p => p.poolType === 'LOSER')?.currentPot  ?? 0,
      },
    })
  } catch (err) {
    console.error('GET /api/suicide error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
