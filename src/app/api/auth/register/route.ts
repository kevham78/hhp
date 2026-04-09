import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const schema = z.object({
  name:     z.string().min(1).max(50),
  email:    z.string().email(),
  password: z.string().min(8),
  token:    z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
    }
    const { name, email, password, token } = parsed.data
    const invite = await prisma.inviteToken.findUnique({ where: { token } })
    if (!invite) return NextResponse.json({ error: 'Invalid invite link.' }, { status: 400 })
    if (invite.usedAt) return NextResponse.json({ error: 'Invite already used.' }, { status: 400 })
    if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite expired.' }, { status: 400 })
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match invite.' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email already registered.' }, { status: 400 })
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, isActive: true, notifyByEmail: true, notifyInApp: true },
    })
    await prisma.inviteToken.update({ where: { token }, data: { usedAt: new Date() } })
    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } })
    if (activeSeason) {
      await prisma.seasonStat.create({ data: { userId: user.id, seasonId: activeSeason.id } })
      await prisma.suicideStatus.create({
        data: { userId: user.id, seasonId: activeSeason.id, winnerTeamsUsed: [], loserTeamsUsed: [] },
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}