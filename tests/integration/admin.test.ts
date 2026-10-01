import { describe, it, expect, beforeEach } from 'vitest'
import * as players from '@/app/api/admin/players/route'
import * as settings from '@/app/api/admin/settings/route'
import * as season from '@/app/api/admin/season/route'
import * as results from '@/app/api/admin/results/route'
import * as email from '@/app/api/admin/email/route'
import * as payments from '@/app/api/payments/route'
import { prisma, createSettings, createSeason, createUser, createPools, joinSeason, asUser, post } from './db'

beforeEach(async () => { await createSettings() })

describe('commissioner-only endpoints', () => {
  const adminOnly: [string, () => Promise<Response>][] = [
    ['GET  /api/admin/players',  () => players.GET()],
    ['POST /api/admin/players',  () => players.POST(post({ action: 'invite', email: 'x@test.invalid', name: 'X' }))],
    ['GET  /api/admin/settings', () => settings.GET()],
    ['POST /api/admin/settings', () => settings.POST(post({ weeklyDues: 100 }))],
    ['POST /api/admin/season',   () => season.POST(post({ action: 'start', seasonId: 'any' }))],
    ['POST /api/admin/results',  () => results.POST(post({ action: 'confirm', weekId: 'any' }))],
    ['POST /api/admin/email',    () => email.POST(post({ subject: 'x', message: 'x' }))],
    ['POST /api/payments',       () => payments.POST(post({ playerId: 'any', amount: 5 }))],
  ]

  it.each(adminOnly)('%s rejects a regular player', async (_name, call) => {
    asUser(await createUser({ role: 'PLAYER' }))
    expect((await call()).status).toBe(401)
  })

  it.each(adminOnly)('%s rejects a logged-out visitor', async (_name, call) => {
    asUser(null)
    expect((await call()).status).toBe(401)
  })
})

describe('start season', () => {
  it('refuses to restart the season that is already running', async () => {
    const running = await createSeason({ active: true })
    const p = await createUser({ seasonId: running.id })
    await prisma.seasonStat.updateMany({ where: { userId: p.id }, data: { totalPoints: 42 } })
    asUser(await createUser({ role: 'ADMIN' }))

    const res = await season.POST(post({ action: 'start', seasonId: running.id }))

    expect(res.status).toBe(400)
    expect((await prisma.seasonStat.findFirstOrThrow({ where: { userId: p.id } })).totalPoints).toBe(42)
  })

  it('starts a new season: only it is active, and everyone starts at zero', async () => {
    const old  = await createSeason({ active: true })
    const next = await createSeason({ active: false })
    await createPools(next.id, 50)
    const p = await createUser({ seasonId: old.id })
    await joinSeason(p.id, next.id)
    await prisma.suicideStatus.updateMany({ where: { seasonId: next.id }, data: { winnerPoolEliminated: true } })
    asUser(await createUser({ role: 'ADMIN' }))

    expect((await season.POST(post({ action: 'start', seasonId: next.id }))).status).toBe(200)

    expect(await prisma.season.findMany({ where: { isActive: true }, select: { id: true } })).toEqual([{ id: next.id }])
    expect(await prisma.suicideStatus.findFirstOrThrow({ where: { userId: p.id, seasonId: next.id } }))
      .toMatchObject({ winnerPoolEliminated: false, winnerTeamsUsed: [] })
    expect((await prisma.suicidePoolState.findMany({ where: { seasonId: next.id } })).map(s => s.currentPot)).toEqual([0, 0])
  })
})
