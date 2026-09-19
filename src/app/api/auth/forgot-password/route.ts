import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import crypto from 'crypto'

const schema = z.object({
  email: z.string().email(),
})

const GENERIC_MESSAGE = "If that email is registered, we've sent a reset link."

export async function POST(req: Request) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const { email } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })

    // Always respond the same way whether or not the account exists,
    // so this endpoint can't be used to discover who's registered.
    if (!user || !user.isActive) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
    }

    // Clear any previous unused reset tokens for this email
    await prisma.verificationToken.deleteMany({ where: { identifier: email } })

    const token   = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    })

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

    if (process.env.RESEND_API_KEY &&
        process.env.RESEND_API_KEY !== 'your-resend-api-key') {
      try {
        const { sendEmail }        = await import('@/lib/email/client')
        const { resetPasswordEmail } = await import('@/lib/email/templates')

        await sendEmail({
          to:      email,
          subject: 'Reset your HHP password',
          html:    resetPasswordEmail({ name: user.name ?? 'Player', resetUrl }),
        })
      } catch (emailErr) {
        console.error('Failed to send reset password email:', emailErr)
      }
    } else {
      console.log('[forgot-password] Resend not configured — reset URL:', resetUrl)
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
  } catch (err) {
    console.error('POST /api/auth/forgot-password error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
