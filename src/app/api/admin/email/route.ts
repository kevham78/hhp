import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { sendEmail } from '@/lib/email/client'
import {
  resultsAndPicksEmail,
  picksReminderEmail,
  picksRevealEmail,
  commissionerNudgeEmail,
} from '@/lib/email/templates'
import { z } from 'zod'

const schema = z.object({
  type:   z.enum(['results', 'reminder', 'reveal', 'nudge']),
  weekId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { type, weekId } = parsed.data

    switch (type) {
      case 'results': return sendResultsEmail(weekId!, session.user.id)
      case 'reminder': return sendReminderEmails(weekId!, false)
      case 'reveal':   return sendRevealEmail(weekId!)
      case 'nudge':    return sendNudgeEmail(weekId!)
      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }
  } catch (err) {
    console.error('POST /api/admin/email error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// Results + Picks Reminder
// ─────────────────────────────────────────────

async function sendResultsEmail(weekId: string, adminId: string) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
  })
  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  // Get weekly stats to find winner
  const stats = await prisma.weeklyStat.findMany({
    where:   { weekId },
    include: { user: true },
    orderBy: { points: 'desc' },
  })

  const settings = await prisma.settings.findFirst({ where: { id: 'default' } })
  const players  = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true, name: true },
  })

  const topPoints  = stats[0]?.points ?? 0
  const winners    = stats.filter(s => s.isWinner)
  const isSplit    = winners.length > 1
  const prizeAmount = isSplit
    ? (settings?.weeklyPrize ?? 30) / winners.length
    : (settings?.weeklyPrize ?? 30)

  const emails = players.map(p => ({
    to:      p.email!,
    subject: `🏒 HHP Week ${week.weekNumber} Results`,
    html:    resultsAndPicksEmail({
      weekNumber:   week.weekNumber,
      winnerName:   isSplit ? null : (winners[0]?.user?.name ?? null),
      winnerPoints: topPoints,
      isSplit,
      splitNames:   winners.map(w => w.user?.name ?? ''),
      prizeAmount,
      weekId,
    }),
  }))

  let sent = 0
  for (const email of emails) {
    try {
      await sendEmail(email)
      sent++
    } catch (err) {
      console.error(`Failed to send results email to ${email.to}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent, total: emails.length })
}

// ─────────────────────────────────────────────
// Picks Reminder (Thursday or Friday)
// ─────────────────────────────────────────────

async function sendReminderEmails(weekId: string, isSecondReminder: boolean) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
  })
  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  // Find players who haven't submitted
  const allPlayers = await prisma.user.findMany({
    where: { isActive: true },
  })

  const submittedUserIds = await prisma.pick.findMany({
    where:  { weekId, isDraft: false },
    select: { userId: true },
    distinct: ['userId'],
  })

  const submittedIds = new Set(submittedUserIds.map(p => p.userId))
  const pending      = allPlayers.filter(p => !submittedIds.has(p.id))

  const deadline = new Date(week.picksDeadline).toLocaleString('en-CA', {
    weekday:      'long',
    month:        'short',
    day:          'numeric',
    hour:         'numeric',
    minute:       '2-digit',
    timeZone:     'America/Toronto',
    timeZoneName: 'short',
  })

  let sent = 0
  for (const player of pending) {
    if (!player.email || !player.notifyByEmail) continue
    try {
      await sendEmail({
        to:      player.email,
        subject: isSecondReminder
          ? `⚠️ Last chance! HHP picks due today`
          : `📋 HHP reminder — picks due Friday`,
        html: picksReminderEmail({
          playerName:       player.name ?? 'Player',
          isSecondReminder,
          deadline,
        }),
      })
      sent++
    } catch (err) {
      console.error(`Failed to send reminder to ${player.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent, pending: pending.length })
}

// ─────────────────────────────────────────────
// Picks Reveal
// ─────────────────────────────────────────────

async function sendRevealEmail(weekId: string) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
  })
  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  const players = await prisma.user.findMany({
    where: { isActive: true, notifyByEmail: true },
    select: { email: true, name: true },
  })

  let sent = 0
  for (const player of players) {
    if (!player.email) continue
    try {
      await sendEmail({
        to:      player.email,
        subject: `🏒 HHP Week ${week.weekNumber} picks are in!`,
        html:    picksRevealEmail({
          weekNumber: week.weekNumber,
          weekId,
        }),
      })
      sent++
    } catch (err) {
      console.error(`Failed to send reveal email to ${player.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent })
}

// ─────────────────────────────────────────────
// Commissioner Nudge
// ─────────────────────────────────────────────

async function sendNudgeEmail(weekId: string) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
  })
  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { email: true, name: true },
  })


  let sent = 0
  for (const admin of admins) {
    if (!admin.email) continue
    try {
      await sendEmail({
        to:      admin.email,
        subject: `📋 HHP — Week ${week.weekNumber} results ready to review`,
        html:    commissionerNudgeEmail({
          commissionerName: admin.name ?? 'Commissioner',
          weekNumber:       week.weekNumber,
          weekId,
        }),
      })
      sent++
    } catch (err) {
      console.error(`Failed to send nudge to ${admin.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent })
}