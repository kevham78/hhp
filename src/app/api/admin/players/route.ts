import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(50),
})

const toggleSchema = z.object({
  userId:   z.string(),
  isActive: z.boolean(),
})

// ─────────────────────────────────────────────
// GET /api/admin/players
// List all players with their season stats
// ─────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
    })

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        seasonStats: season
          ? { where: { seasonId: season.id } }
          : false,
        picks: {
          where:    { isDraft: false },
          orderBy:  { createdAt: 'desc' },
          take:     1,
        },
      },
    })

    // Get current week for pick status
    const currentWeek = season
      ? await prisma.week.findFirst({
          where:   { seasonId: season.id, status: 'OPEN' },
          orderBy: { weekNumber: 'desc' },
        })
      : null

    const players = users.map(user => {
      const stat        = user.seasonStats?.[0]
      const hasPickedThisWeek = currentWeek
        ? user.picks.some(p => p.weekId === currentWeek.id)
        : false

      return {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        isActive:     user.isActive,
        image:        user.image,
        totalPoints:  stat?.totalPoints  ?? 0,
        weeklyWins:   stat?.weeklyWins   ?? 0,
        monthlyWins:  stat?.monthlyWins  ?? 0,
        hasPicked:    hasPickedThisWeek,
        currentWeekId: currentWeek?.id ?? null,
      }
    })

    return NextResponse.json({ players, currentWeek })
  } catch (err) {
    console.error('GET /api/admin/players error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/players
// Two actions: invite and toggle
// ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const action = body.action as 'invite' | 'toggle'

    if (action === 'invite') return handleInvite(body, session.user.id)
    if (action === 'toggle') return handleToggle(body)

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/players error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// Send invite
// ─────────────────────────────────────────────

async function handleInvite(body: any, adminId: string) {
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or name' }, { status: 400 })
  }

  const { email, name } = parsed.data

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'A player with this email already exists.' },
      { status: 400 }
    )
  }

  // Check for existing unused invite
  const existingInvite = await prisma.inviteToken.findFirst({
    where: {
      email,
      usedAt:    null,
      expiresAt: { gt: new Date() },
    },
  })

  if (existingInvite) {
    return NextResponse.json(
      { error: 'An invite has already been sent to this email.' },
      { status: 400 }
    )
  }

  // Create invite token — expires in 7 days
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invite = await prisma.inviteToken.create({
    data: {
      email,
      createdBy: adminId,
      expiresAt,
    },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?token=${invite.token}&email=${encodeURIComponent(email)}`

  // Send email if SendGrid is configured
  if (process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key') {
    try {
      const sgMail = await import('@sendgrid/mail')
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY)
      await sgMail.default.send({
        to:      email,
        from:    process.env.EMAIL_FROM!,
        subject: "You're invited to join the Hicks Hockey Pool! 🏒",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #d4a843;">🏒 Hicks Hockey Pool</h1>
            <p>Hi ${name},</p>
            <p>You've been invited to join the <strong>Hicks Hockey Pool</strong> for the 2026-27 NHL season!</p>
            <p>Click the link below to create your account:</p>
            <a href="${inviteUrl}"
               style="display: inline-block; background: #e8132a; color: white;
                      padding: 12px 24px; border-radius: 8px; text-decoration: none;
                      font-weight: bold; margin: 16px 0;">
              Accept Invite & Create Account
            </a>
            <p style="color: #666; font-size: 14px;">
              This link expires in 7 days. If you have any questions,
              contact your commissioner.
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr)
      // Don't fail the whole request — return invite URL so admin can share manually
      return NextResponse.json({
        success:   true,
        inviteUrl,
        emailSent: false,
        message:   'Invite created but email failed to send. Share the link manually.',
      })
    }
  }

  return NextResponse.json({
    success:   true,
    inviteUrl,
    emailSent: !!process.env.SENDGRID_API_KEY &&
               process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key',
    message:   'Invite sent successfully!',
  })
}

// ─────────────────────────────────────────────
// Toggle player active/inactive
// ─────────────────────────────────────────────

async function handleToggle(body: any) {
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const { userId, isActive } = parsed.data

  await prisma.user.update({
    where: { id: userId },
    data:  { isActive },
  })

  return NextResponse.json({ success: true })
}