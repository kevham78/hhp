import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  email:       z.string().email(),
  token:       z.string().min(1),
  newPassword: z.string().min(8),
})

const INVALID_MESSAGE = 'This reset link is invalid or has expired. Request a new one.'

export async function POST(req: Request) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const { email, token, newPassword } = parsed.data

    const record = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: email, token } },
    })

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hashed, mustChangePassword: false },
    })

    // Single use — remove it now that it's been consumed
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/auth/reset-password error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
