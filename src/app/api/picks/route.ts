import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { getOrCreateCurrentWeek, isPastDeadline, addMissingGames } from '@/lib/db/weeks'
import { getWeekendGames } from '@/lib/api/nhl'
import { z } from 'zod'

// ─────────────────────────────────────────────
// Validation schema for incoming picks
// ─────────────────────────────────────────────

const picksSchema = z.object({
  // gameId -> team code e.g. { "game123": "BOS" }
  picks: z.record(z.string(), z.string()),

  // gameId -> tiebreaker rank (1, 2, or 3)
  tiebreakers: z.record(z.string(), z.number().min(1).max(3)),

  // suicide picks
  suicide: z.object({
    winner: z.string().nullable(),
    loser:  z.string().nullable(),
  }),

  // true = final submit, false = save draft
  isDraft: z.boolean(),
})

// ─────────────────────────────────────────────
// GET /api/picks
// Load current week picks for the logged-in user
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const week = await getOrCreateCurrentWeek()
    if (!week) {
      return NextResponse.json({ error: 'No active season' }, { status: 404 })
    }

    // Load existing picks for this user and week
    const picks = await prisma.pick.findMany({
      where: {
        userId: session.user.id,
        weekId: week.id,
      },
    })

    // Load suicide picks
    const suicidePicks = await prisma.suicidePick.findMany({
      where: {
        userId: session.user.id,
        weekId: week.id,
      },
    })

    return NextResponse.json({
      weekId:       week.id,
      picks,
      suicidePicks,
      deadline:     week.picksDeadline,
      isOpen:       new Date() < new Date(week.picksDeadline),
    })
  } catch (err) {
    console.error('GET /api/picks error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/picks
// Save draft or submit final picks
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const parsed = picksSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid picks data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { picks, tiebreakers, suicide, isDraft } = parsed.data

    // Get current week
    const week = await getOrCreateCurrentWeek()
    if (!week) {
      return NextResponse.json({ error: 'No active season' }, { status: 404 })
    }

    // Check deadline — no changes at all after Friday 2pm, drafts
    // included: picks are revealed then, so a "draft" save would let
    // someone change picks after seeing everyone else's.
    // In development, always allow submission for testing
if (isPastDeadline(week) && process.env.NODE_ENV !== 'development') {
  return NextResponse.json(
    { error: 'Picks deadline has passed' },
    { status: 400 }
  )
}

    // A picked game we don't have yet (NHL added it after the week was
    // created) — add it from the schedule rather than dropping the pick.
    const knownGames = new Set(week.games.map(g => g.nhlGameId))
    if (Object.keys(picks).some(id => !knownGames.has(id))) {
      const { saturday, sunday } = await getWeekendGames(
        new Date(week.saturdayDate),
        new Date(week.sundayDate)
      )
      await addMissingGames(week, saturday, sunday)
    }

    const userId      = session.user.id
    const submittedAt = isDraft ? null : new Date()

   // ── Save regular picks ──────────────────────
for (const [nhlGameId, pickedTeam] of Object.entries(picks)) {
  // Look up our DB game record by NHL game ID
  const dbGame = await prisma.game.findFirst({
    where: { weekId: week.id, nhlGameId },
  })
  if (!dbGame) continue

  await prisma.pick.upsert({
    where: {
      userId_weekId_gameId: {
        userId,
        weekId: week.id,
        gameId: dbGame.id,
      },
    },
    update: {
      pickedTeam,
      tiebreakerRank: tiebreakers[nhlGameId] ?? null,
      isDraft,
      submittedAt,
    },
    create: {
      userId,
      weekId:         week.id,
      gameId:         dbGame.id,
      pickedTeam,
      tiebreakerRank: tiebreakers[nhlGameId] ?? null,
      isDraft,
      submittedAt,
    },
  })
}

// ── Save suicide picks ──────────────────────
// Only for pools the player is still in
const suicideStatus = await prisma.suicideStatus.findUnique({
  where: { userId_seasonId: { userId, seasonId: week.seasonId } },
})
if (suicideStatus?.winnerPoolEliminated) suicide.winner = null
if (suicideStatus?.loserPoolEliminated)  suicide.loser  = null

if (suicide.winner) {
  const winnerGame = await prisma.game.findFirst({
    where: { weekId: week.id, nhlGameId: suicide.winner },
  })
  if (winnerGame) {
    const winnerTeam = picks[suicide.winner]
    if (winnerTeam) {
      await prisma.suicidePick.upsert({
        where:  { userId_weekId_poolType: { userId, weekId: week.id, poolType: 'WINNER' } },
        update: { pickedTeam: winnerTeam, isDraft, submittedAt },
        create: { userId, weekId: week.id, poolType: 'WINNER', pickedTeam: winnerTeam, isDraft, submittedAt },
      })
    }
  }
}

if (suicide.loser) {
  const loserGame = await prisma.game.findFirst({
    where: { weekId: week.id, nhlGameId: suicide.loser },
  })
  if (loserGame) {
    // Loser team is the opponent of what was picked
    const pickedWinner = picks[suicide.loser]
    const loserTeam = pickedWinner === loserGame.homeTeamCode
      ? loserGame.awayTeamCode
      : loserGame.homeTeamCode
    await prisma.suicidePick.upsert({
      where:  { userId_weekId_poolType: { userId, weekId: week.id, poolType: 'LOSER' } },
      update: { pickedTeam: loserTeam, isDraft, submittedAt },
      create: { userId, weekId: week.id, poolType: 'LOSER', pickedTeam: loserTeam, isDraft, submittedAt },
    })
  }
}

    return NextResponse.json({
      success: true,
      isDraft,
      message: isDraft ? 'Draft saved!' : 'Picks submitted!',
    })
  } catch (err) {
    console.error('POST /api/picks error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}