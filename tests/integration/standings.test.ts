import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '@/app/api/standings/route'
import { prisma, createSeason, createUser, createWeek, asUser } from './db'

let season: Awaited<ReturnType<typeof createSeason>>

const score = (userId: string, weekId: string, points: number, isWinner = false) =>
  prisma.weeklyStat.create({ data: { userId, weekId, seasonId: season.id, points, isWinner } })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  season = await createSeason()
})

afterEach(() => vi.useRealTimers())

describe('GET /api/standings — month by month', () => {
  it('totals each player\'s points per month, grouping weeks by their Saturday', async () => {
    const [a, b] = [await createUser({ name: 'A', seasonId: season.id }), await createUser({ name: 'B', seasonId: season.id })]
    // A Saturday on the 1st is stored as UTC midnight — still May, not April
    const apr17 = await createWeek({ seasonId: season.id, number: 1, saturday: '2027-04-17', status: 'COMPLETED' })
    const apr24 = await createWeek({ seasonId: season.id, number: 2, saturday: '2027-04-24', status: 'COMPLETED' })
    const may1  = await createWeek({ seasonId: season.id, number: 3, saturday: '2027-05-01', status: 'COMPLETED' })
    await createWeek({ seasonId: season.id, number: 4, saturday: '2027-05-08' })   // not played yet

    await score(a.id, apr17.id, 5, true); await score(b.id, apr17.id, 3)
    await score(a.id, apr24.id, 2);       await score(b.id, apr24.id, 6, true)
    await score(a.id, may1.id, 4);        await score(b.id, may1.id, 4)
    // April has been closed (winner recorded); May hasn't
    await prisma.monthlyResult.create({ data: { seasonId: season.id, userId: b.id, year: 2027, month: 4, points: 9, isWinner: true } })
    await prisma.monthlyResult.create({ data: { seasonId: season.id, userId: a.id, year: 2027, month: 4, points: 7 } })

    asUser(a)
    const data = await (await GET()).json()

    const months = (name: string) => data.standings.find((p: any) => p.name === name).monthlyPoints
    expect(months('A')).toEqual([{ month: '2027-04', points: 7 }, { month: '2027-05', points: 4 }])
    expect(months('B')).toEqual([{ month: '2027-04', points: 9 }, { month: '2027-05', points: 4 }])

    expect(data.monthHistory).toEqual([
      { month: '2027-04', weekCount: 2, topPoints: 9, leaderIds: [b.id],       leaderNames: ['B'],      isTied: false, inProgress: false },
      { month: '2027-05', weekCount: 1, topPoints: 4, leaderIds: [b.id, a.id], leaderNames: ['B', 'A'], isTied: true,  inProgress: true  },
    ])
  })
})

describe('GET /api/standings — season ranking', () => {
  it('ranks by money won, then weekly wins, then monthly wins, then points; players equal on all four share a rank', async () => {
    const week = await createWeek({ seasonId: season.id, number: 1, saturday: '2026-10-03', status: 'COMPLETED' })
    const players: Record<string, string> = {}
    const rows: [string, number[], number, number, number][] = [   // name, prizes won, weekly wins, monthly wins, points
      ['A', [30, 5],  1, 1,  8],   // most money, despite fewer points
      ['B', [30],     1, 1, 12],
      ['C', [15, 15], 1, 1, 12],   // same as B on everything -> tied
      ['D', [30],     1, 0, 20],   // fewer monthly wins than B and C
      ['E', [30],     0, 0, 25],   // suicide pot — no weekly wins
      ['F', [],       0, 0, 30],   // best record, no money
      ['G', [],       0, 0,  9],
    ]
    for (const [name, prizes, weeklyWins, monthlyWins, totalPoints] of rows) {
      const u = await createUser({ name, seasonId: season.id })
      players[name] = u.id
      await prisma.seasonStat.update({
        where: { userId_seasonId: { userId: u.id, seasonId: season.id } },
        data:  { totalPoints, weeklyWins },
      })
      for (let m = 1; m <= monthlyWins; m++) {
        await prisma.monthlyResult.create({ data: { seasonId: season.id, userId: u.id, year: 2026, month: 9 + m, isWinner: true } })
      }
      for (const amount of prizes) {
        await prisma.payment.create({ data: {
          seasonId: season.id, weekId: week.id, playerId: u.id, recipientId: u.id, createdBy: u.id,
          type: name === 'E' ? 'SUICIDE_WINNING' : 'WEEKLY_WINNING', amount, description: 'prize',
        } })
      }
    }
    // Dues paid to the commissioner aren't winnings
    await prisma.payment.create({ data: {
      seasonId: season.id, playerId: players.G, createdBy: players.G, type: 'DUES_PAID', amount: 100, description: 'dues',
    } })

    asUser({ id: players.A } as any)
    const data = await (await GET()).json()

    expect(data.standings.map((p: any) => [p.name, p.rank, p.isTied, p.moneyWon])).toEqual([
      ['A', 1, false, 35],
      ['B', 2, true,  30],
      ['C', 2, true,  30],
      ['D', 4, false, 30],
      ['E', 5, false, 30],
      ['F', 6, false,  0],
      ['G', 7, false,  0],
    ])
  })
})
