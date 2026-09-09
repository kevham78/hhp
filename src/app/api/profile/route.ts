import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const profileSchema = z.object({
  name:            z.string().min(1).max(50),
  notifyByEmail:   z.boolean(),
  notifyInApp:     z.boolean(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const action = body.action as 'profile' | 'password'

    if (action === 'profile') {
      const parsed = profileSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data:  parsed.data,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'password') {
      const parsed = passwordSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
      }

      const { currentPassword, newPassword } = parsed.data

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      })

      if (!user?.password) {
        return NextResponse.json(
          { error: 'Cannot change password for Google accounts' },
          { status: 400 }
        )
      }

      const match = await bcrypt.compare(currentPassword, user.password)
      if (!match) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      const hashed = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: session.user.id },
        data:  { password: hashed },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/profile error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}