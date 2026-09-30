import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { computeWeekResults } from '@/lib/db/weeklyResults'

// ─────────────────────────────────────────────
// GET /api/weekly-picks
// The current (revealed, not yet processed)
// week's picks for every player, with live
// per-game scores/highlights as games finish —
// open to any logged-in player, not just the
// commissioner. Once a week is processed it
// drops off here (it lives on the Results page)
// until the next week's picks are revealed.
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
      return NextResponse.json({ published: false })
    }

    const week = await prisma.week.findFirst({
      where:   { seasonId: season.id, picksPublished: true, status: 'LOCKED' },
      orderBy: { weekNumber: 'desc' },
    })

    if (!week) {
      return NextResponse.json({ published: false })
    }

    const result = await computeWeekResults(week.id)
    if (!result) {
      return NextResponse.json({ published: false })
    }

    return NextResponse.json({ published: true, ...result })
  } catch (err) {
    console.error('GET /api/weekly-picks error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
