import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const startSchema = z.object({
  action: z.literal('start'),
  seasonId: z.string(),
})

// ─────────────────────────────────────────────
// POST /api/admin/season
// Start season — resets all stats
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const parsed = startSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const { seasonId } = parsed.data

    // Deactivate all other seasons
    await prisma.season.updateMany({
      where: { isActive: true },
      data:  { isActive: false },
    })

    // Activate the selected season
    await prisma.season.update({
      where: { id: seasonId },
      data:  { isActive: true },
    })

    // Reset all season stats for active players
    const players = await prisma.user.findMany({
      where: { isActive: true },
    })

    for (const player of players) {
      await prisma.seasonStat.upsert({
        where:  { userId_seasonId: { userId: player.id, seasonId } },
        update: {
          totalPoints:   0,
          weeklyWins:    0,
          monthlyWins:   0,
          monthlyPoints: 0,
        },
        create: {
          userId:        player.id,
          seasonId,
          totalPoints:   0,
          weeklyWins:    0,
          monthlyWins:   0,
          monthlyPoints: 0,
        },
      })

      await prisma.suicideStatus.upsert({
        where:  { userId_seasonId: { userId: player.id, seasonId } },
        update: {
          winnerPoolEliminated: false,
          winnerPoolStrikes:    0,
          loserPoolEliminated:  false,
          loserPoolStrikes:     0,
          winnerTeamsUsed:      [],
          loserTeamsUsed:       [],
        },
        create: {
          userId:               player.id,
          seasonId,
          winnerPoolEliminated: false,
          winnerPoolStrikes:    0,
          loserPoolEliminated:  false,
          loserPoolStrikes:     0,
          winnerTeamsUsed:      [],
          loserTeamsUsed:       [],
        },
      })
    }

    // Reset suicide pool state
    await prisma.suicidePoolState.upsert({
      where:  { poolType_seasonId: { poolType: 'WINNER', seasonId } },
      update: { currentPot: 0, isActive: true, weekId: null },
      create: { poolType: 'WINNER', seasonId, currentPot: 0, isActive: true },
    })

    await prisma.suicidePoolState.upsert({
      where:  { poolType_seasonId: { poolType: 'LOSER', seasonId } },
      update: { currentPot: 0, isActive: true, weekId: null },
      create: { poolType: 'LOSER', seasonId, currentPot: 0, isActive: true },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/admin/season error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}