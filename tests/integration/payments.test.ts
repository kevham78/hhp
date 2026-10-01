import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/payments/route'
import { prisma, createSettings, createSeason, createUser, createPools, createWeek, asUser, post } from './db'

let season: Awaited<ReturnType<typeof createSeason>>

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  await createSettings({ weeklyDues: 5 })
  season = await createSeason()
  await createPools(season.id, 15)
  await createWeek({ seasonId: season.id, number: 1, saturday: '2026-10-03', status: 'COMPLETED' })
  await createWeek({ seasonId: season.id, number: 2, saturday: '2026-10-10', status: 'OPEN' })
})

afterEach(() => vi.useRealTimers())

const playerRow = async (userId: string) =>
  (await (await GET()).json()).playerFinancials.find((p: any) => p.userId === userId)

describe('GET /api/payments', () => {
  it('dues for a week start counting at 8am Eastern on its Friday', async () => {
    const p = await createUser({ seasonId: season.id })
    asUser(p)

    vi.setSystemTime(new Date('2026-10-09T11:59:00Z'))   // Fri Oct 9, 7:59am EDT
    expect((await playerRow(p.id)).duesOwed).toBe(5)

    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))   // 8:00am EDT
    expect((await playerRow(p.id)).duesOwed).toBe(10)
  })

  it('balance = dues owed - winnings - cash paid', async () => {
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
    const p = await createUser({ seasonId: season.id })
    const admin = await createUser({ role: 'ADMIN' })
    const week1 = await prisma.week.findFirstOrThrow({ where: { weekNumber: 1 } })
    await prisma.payment.create({ data: {
      playerId: p.id, recipientId: p.id, weekId: week1.id, type: 'WEEKLY_WINNING', amount: 30,
      description: 'Week 1 winner', createdBy: admin.id } })

    asUser(admin)
    expect((await POST(post({ playerId: p.id, amount: 4, note: 'cash' }))).status).toBe(200)

    expect(await playerRow(p.id)).toMatchObject({ duesOwed: 10, winnings: 30, paid: 4, netBalance: -24 })
    const body = await (await GET()).json()
    expect(body.suicidePots).toEqual({ winner: 15, loser: 15 })
  })

  it('rejects a zero or negative payment', async () => {
    asUser(await createUser({ role: 'ADMIN' }))
    const p = await createUser()
    expect((await POST(post({ playerId: p.id, amount: 0 }))).status).toBe(400)
    expect((await POST(post({ playerId: p.id, amount: -5 }))).status).toBe(400)
  })
})
