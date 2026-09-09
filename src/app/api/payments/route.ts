import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const logPaymentSchema = z.object({
  playerId: z.string(),
  amount:   z.number().min(0.01),
  note:     z.string().optional(),
})

// ─────────────────────────────────────────────
// GET /api/payments
// Returns financials for all players
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

    const settings = await prisma.settings.findFirst({
      where: { id: 'default' },
    })

    // Count completed weeks this season
    const completedWeeks = await prisma.week.count({
      where: {
        seasonId: season.id,
        status:   'COMPLETED',
      },
    })

    // Get all active players
    const players = await prisma.user.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
    })

    // Get all payments this season
    const allPayments = await prisma.payment.findMany({
      where: {
        week: {
          seasonId: season.id,
        },
      },
      include: { week: true },
      orderBy: { createdAt: 'desc' },
    })

    // Get dues payments (cash paid to commissioner)
    const duesPayments = await prisma.payment.findMany({
      where: {
        type:    'DUES_PAID',
        weekId:  null,
        playerId: { in: players.map(p => p.id) },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get monthly results
    const monthlyResults = await prisma.monthlyResult.findMany({
      where: { seasonId: season.id },
    })

    // Current month tracking
    const now          = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear  = now.getFullYear()

    // Monthly points — sum weekly points for games this month
    const currentMonthWeeks = await prisma.week.findMany({
      where: {
        seasonId: season.id,
        status:   'COMPLETED',
        saturdayDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt:  new Date(currentYear, currentMonth, 1),
        },
      },
    })

    const currentMonthStats = await prisma.weeklyStat.findMany({
      where: {
        weekId: { in: currentMonthWeeks.map(w => w.id) },
      },
    })

    // Build monthly points per player for current month
    const monthlyPoints: Record<string, number> = {}
    for (const stat of currentMonthStats) {
      monthlyPoints[stat.userId] = (monthlyPoints[stat.userId] ?? 0) + stat.points
    }

    // Get suicide pool state
    const suicidePools = await prisma.suicidePoolState.findMany({
      where: { seasonId: season.id },
    })

    const winnerPool = suicidePools.find(p => p.poolType === 'WINNER')
    const loserPool  = suicidePools.find(p => p.poolType === 'LOSER')

    // Build per-player financials
    const weeklyDues = settings?.weeklyDues ?? 5

    const playerFinancials = players.map(player => {
      // Total dues owed based on completed weeks
      const duesOwed = completedWeeks * weeklyDues

      // Total winnings from payments table
      const winnings = allPayments
        .filter(p => p.recipientId === player.id)
        .reduce((sum, p) => sum + p.amount, 0)

      // Cash paid to commissioner
      const paid = duesPayments
        .filter(p => p.playerId === player.id)
        .reduce((sum, p) => sum + p.amount, 0)

      // Net balance: positive = owes commissioner, negative = commissioner owes them
      const netBalance = duesOwed - winnings - paid

      // Transaction history
      const transactions = [
        ...allPayments
          .filter(p => p.recipientId === player.id || p.playerId === player.id)
          .map(p => ({
            id:          p.id,
            date:        p.createdAt,
            type:        p.type,
            amount:      p.recipientId === player.id ? p.amount : -p.amount,
            description: p.description,
            weekNumber:  p.week?.weekNumber ?? null,
          })),
        ...duesPayments
          .filter(p => p.playerId === player.id)
          .map(p => ({
            id:          p.id,
            date:        p.createdAt,
            type:        'DUES_PAID' as const,
            amount:      p.amount,
            description: p.description || 'Payment to commissioner',
            weekNumber:  null,
          })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Monthly wins
      const monthlyWins = monthlyResults.filter(
        r => r.userId === player.id && r.isWinner
      )

      return {
        userId:          player.id,
        name:            player.name,
        image:           player.image,
        duesOwed,
        winnings,
        paid,
        netBalance,
        monthlyPoints:   monthlyPoints[player.id] ?? 0,
        monthlyWins:     monthlyWins.length,
        transactions,
      }
    })

    // Monthly pot size
    const monthlyPot = currentMonthWeeks.length * (settings?.monthlyPrize ?? 5)

    // Monthly standings for current month
    const monthlyStandings = [...playerFinancials]
      .sort((a, b) => b.monthlyPoints - a.monthlyPoints)

    return NextResponse.json({
      seasonId:         season.id,
      completedWeeks,
      weeklyDues,
      playerFinancials,
      monthlyStandings,
      monthlyPot,
      currentMonth,
      currentYear,
      suicidePots: {
        winner: winnerPool?.currentPot ?? 0,
        loser:  loserPool?.currentPot  ?? 0,
      },
    })
  } catch (err) {
    console.error('GET /api/payments error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/payments
// Commissioner logs a payment received
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const parsed = logPaymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const { playerId, amount, note } = parsed.data

    const payment = await prisma.payment.create({
      data: {
        playerId,
        type:        'DUES_PAID',
        amount,
        description: note || 'Payment to commissioner',
        createdBy:   session.user.id,
      },
    })

    return NextResponse.json({ success: true, payment })
  } catch (err) {
    console.error('POST /api/payments error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}