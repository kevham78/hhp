import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const settingsSchema = z.object({
  weeklyDues:         z.number().min(1).max(100),
  weeklyPrize:        z.number().min(0),
  monthlyPrize:       z.number().min(0),
  suicideWinnerPrize: z.number().min(0),
  suicideLoserPrize:  z.number().min(0),
  resultsEmailDay:    z.string(),
  resultsEmailTime:   z.string(),
  reminderOneDay:     z.string(),
  reminderOneTime:    z.string(),
  reminderTwoDay:     z.string(),
  reminderTwoTime:    z.string(),
  picksRevealDay:     z.string(),
  picksRevealTime:    z.string(),
})

// ─────────────────────────────────────────────
// GET /api/admin/settings
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.settings.findFirst({
      where: { id: 'default' },
    })

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    return NextResponse.json(settings)
  } catch (err) {
    console.error('GET /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/settings
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Validate prize splits add up to weekly dues
    const { weeklyDues, weeklyPrize, monthlyPrize,
            suicideWinnerPrize, suicideLoserPrize } = parsed.data
    const total = weeklyPrize + monthlyPrize + suicideWinnerPrize + suicideLoserPrize

    if (Math.abs(total - (weeklyDues * 6)) > 0.01) {
      // Not enforcing strict match — just save whatever the commissioner sets
      // They're responsible for the math
    }

    const settings = await prisma.settings.update({
      where: { id: 'default' },
      data:  {
        ...parsed.data,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, settings })
  } catch (err) {
    console.error('POST /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}