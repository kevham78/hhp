import { describe, it, expect, beforeEach } from 'vitest'
import { confirmWeekResults } from '@/lib/db/results'
import {
  prisma, createSettings, createSeason, createUser, createPools, createWeek,
  publishWeekToNhl, submitPicks, suicidePick, status, sentEmails,
} from './db'

// Week used throughout: TOR beat MTL 4-1, NYR beat BOS 3-2, EDM beat CGY 5-0
const GAMES  = [{ home: 'TOR', away: 'MTL' }, { home: 'BOS', away: 'NYR' }, { home: 'EDM', away: 'CGY' }]
const FINALS: Record<string, [number, number]> = { TOR: [4, 1], BOS: [2, 3], EDM: [5, 0] }

// Suicide payouts from one pool (the other pool is resolved in the same run)
const payouts = (pool: 'WINNER' | 'LOSER') =>
  prisma.payment.findMany({ where: { type: 'SUICIDE_WINNING', description: { contains: pool } } })

let season: Awaited<ReturnType<typeof createSeason>>
let week:   Awaited<ReturnType<typeof createWeek>>

async function players(n: number) {
  return Promise.all(Array.from({ length: n }, (_, i) =>
    createUser({ name: 'ABCDEFG'[i], seasonId: season.id })))
}

beforeEach(async () => {
  await createSettings()
  season = await createSeason()
  await createPools(season.id)
  week = await createWeek({ seasonId: season.id, status: 'LOCKED', published: true, games: GAMES })
  publishWeekToNhl(week, FINALS)
})

describe('weekly scoring', () => {
  it('scores picks, pays the weekly winner and completes the week', async () => {
    const [a, b, c] = await players(3)
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })   // 3
    await submitPicks(b.id, week, { TOR: 'TOR', BOS: 'BOS', EDM: 'EDM' })   // 2
    await submitPicks(c.id, week, { TOR: 'MTL', BOS: 'BOS', EDM: 'CGY' })   // 0

    expect(await confirmWeekResults(week.id)).toEqual({ success: true })

    const stats = await prisma.weeklyStat.findMany({ where: { weekId: week.id } })
    const by = (id: string) => stats.find(s => s.userId === id)!
    expect([by(a.id).points, by(b.id).points, by(c.id).points]).toEqual([3, 2, 0])
    expect(by(a.id).isWinner).toBe(true)
    expect(by(b.id).isWinner).toBe(false)

    const prizes = await prisma.payment.findMany({ where: { type: 'WEEKLY_WINNING' } })
    expect(prizes).toHaveLength(1)
    expect(prizes[0]).toMatchObject({ recipientId: a.id, amount: 30 })

    const seasonA = await prisma.seasonStat.findFirstOrThrow({ where: { userId: a.id } })
    expect(seasonA).toMatchObject({ totalPoints: 3, weeklyWins: 1 })

    const done = await prisma.week.findUniqueOrThrow({ where: { id: week.id }, include: { games: true } })
    expect(done).toMatchObject({ status: 'COMPLETED', picksPublished: true })
    expect(done.games.find(g => g.homeTeamCode === 'BOS')).toMatchObject({ winner: 'NYR', status: 'FINAL', homeScore: 2, awayScore: 3 })

    const graded = await prisma.pick.findMany({ where: { userId: c.id } })
    expect(graded.every(p => p.isCorrect === false)).toBe(true)

    // Results email goes to every active player who wants email
    expect(sentEmails()).toHaveLength(3)
  })

  it('breaks a points tie with the 1st tiebreaker', async () => {
    const [a, b] = await players(2)
    // Both score 2; A's 1st tiebreaker (TOR) was right, B's (BOS) wrong
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'CGY' }, { TOR: 1, BOS: 2, EDM: 3 })
    await submitPicks(b.id, week, { TOR: 'TOR', BOS: 'BOS', EDM: 'EDM' }, { BOS: 1, TOR: 2, EDM: 3 })

    await confirmWeekResults(week.id)

    const prizes = await prisma.payment.findMany({ where: { type: 'WEEKLY_WINNING' } })
    expect(prizes).toHaveLength(1)
    expect(prizes[0].recipientId).toBe(a.id)
  })

  it('splits the prize when still tied after all three tiebreakers', async () => {
    const [a, b] = await players(2)
    for (const p of [a, b]) await submitPicks(p.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' }, { TOR: 1, BOS: 2, EDM: 3 })

    await confirmWeekResults(week.id)

    const prizes = await prisma.payment.findMany({ where: { type: 'WEEKLY_WINNING' } })
    expect(prizes.map(p => p.amount)).toEqual([15, 15])
    const stats = await prisma.weeklyStat.findMany({ where: { weekId: week.id } })
    expect(stats.every(s => s.isWinner && s.isTied)).toBe(true)
  })
})

// Give a player strikes in a pool before the week is confirmed
const strike = (userId: string, data: object) =>
  prisma.suicideStatus.update({ where: { userId_seasonId: { userId, seasonId: season.id } }, data })

describe('suicide pools (winner pool: 2 strikes, loser pool: 1, last player standing)', () => {
  it('winner pool: a wrong or missed pick is a strike, not yet out; the pot grows', async () => {
    const [a, b, c, d] = await players(4)
    await suicidePick(a.id, week.id, 'WINNER', 'TOR')   // won
    await suicidePick(b.id, week.id, 'WINNER', 'MTL')   // lost
    await suicidePick(c.id, week.id, 'WINNER', 'NYR')   // won
    // d: no pick

    await confirmWeekResults(week.id)

    expect(await status(a.id, season.id)).toMatchObject({ winnerPoolEliminated: false, winnerTeamsUsed: ['TOR'] })
    expect(await status(c.id, season.id)).toMatchObject({ winnerPoolEliminated: false })
    expect(await status(b.id, season.id)).toMatchObject({ winnerPoolEliminated: false, winnerPoolStrikes: 1, winnerTeamsUsed: ['MTL'] })
    expect(await status(d.id, season.id)).toMatchObject({ winnerPoolEliminated: false, winnerPoolStrikes: 1 })

    const pool = await prisma.suicidePoolState.findFirstOrThrow({ where: { poolType: 'WINNER' } })
    expect(pool.currentPot).toBe(5)
    expect((await payouts('WINNER')).length).toBe(0)
  })

  it('winner pool: a second strike knocks the player out', async () => {
    const [a, b, c, d] = await players(4)
    await strike(b.id, { winnerPoolStrikes: 1 })
    await strike(c.id, { winnerPoolStrikes: 1 })
    await suicidePick(a.id, week.id, 'WINNER', 'TOR')   // won
    await suicidePick(d.id, week.id, 'WINNER', 'EDM')   // won (two left, so no payout/reset)
    await suicidePick(b.id, week.id, 'WINNER', 'MTL')   // lost -> 2nd strike
    // c: no pick -> 2nd strike

    await confirmWeekResults(week.id)

    expect(await status(b.id, season.id)).toMatchObject({ winnerPoolEliminated: true, winnerPoolStrikes: 2 })
    expect(await status(c.id, season.id)).toMatchObject({ winnerPoolEliminated: true, winnerPoolStrikes: 2 })
  })

  it('loser pool: survive by picking a team that loses', async () => {
    const [a, b, c] = await players(3)
    await suicidePick(a.id, week.id, 'LOSER', 'MTL')   // lost -> survives
    await suicidePick(b.id, week.id, 'LOSER', 'TOR')   // won  -> out
    await suicidePick(c.id, week.id, 'LOSER', 'BOS')   // lost -> survives

    await confirmWeekResults(week.id)

    expect((await status(a.id, season.id)).loserPoolEliminated).toBe(false)
    expect((await status(b.id, season.id)).loserPoolEliminated).toBe(true)
    expect((await status(c.id, season.id)).loserPoolEliminated).toBe(false)
  })

  it('pays the whole pot to the last player standing, then resets the pool', async () => {
    await prisma.suicidePoolState.updateMany({ where: { poolType: 'WINNER' }, data: { currentPot: 20 } })
    const [a, b] = await players(2)
    await strike(b.id, { winnerPoolStrikes: 1 })
    await suicidePick(a.id, week.id, 'WINNER', 'TOR')   // won
    await suicidePick(b.id, week.id, 'WINNER', 'MTL')   // lost -> 2nd strike, out

    await confirmWeekResults(week.id)

    const pay = await payouts('WINNER')
    expect(pay).toHaveLength(1)
    expect(pay[0]).toMatchObject({ recipientId: a.id, amount: 25 })   // 20 carried + 5 this week

    for (const p of [a, b]) {
      expect(await status(p.id, season.id)).toMatchObject({
        winnerPoolEliminated: false, winnerPoolStrikes: 0, winnerTeamsUsed: [] })
    }
    expect((await prisma.suicidePoolState.findFirstOrThrow({ where: { poolType: 'WINNER' } })).currentPot).toBe(0)
  })

  it('splits the pot when everyone still in is knocked out the same week', async () => {
    await prisma.suicidePoolState.updateMany({ where: { poolType: 'WINNER' }, data: { currentPot: 10 } })
    const [a, b] = await players(2)
    for (const p of [a, b]) await strike(p.id, { winnerPoolStrikes: 1 })
    await suicidePick(a.id, week.id, 'WINNER', 'MTL')
    await suicidePick(b.id, week.id, 'WINNER', 'BOS')

    await confirmWeekResults(week.id)

    const pay = await payouts('WINNER')
    expect(pay.map(p => p.amount)).toEqual([7.5, 7.5])
  })

  it('players already knocked out stay out', async () => {
    const [a, b, c] = await players(3)
    await strike(b.id, { winnerPoolEliminated: true, winnerPoolStrikes: 2 })
    await suicidePick(a.id, week.id, 'WINNER', 'TOR')
    await suicidePick(b.id, week.id, 'WINNER', 'NYR')   // correct, but already out
    await suicidePick(c.id, week.id, 'WINNER', 'EDM')

    await confirmWeekResults(week.id)

    expect((await status(b.id, season.id)).winnerPoolEliminated).toBe(true)
    expect((await payouts('WINNER')).length).toBe(0)
  })
})

describe('monthly prize', () => {
  const monthly = () => prisma.payment.findMany({ where: { type: 'MONTHLY_WINNING' }, orderBy: { amount: 'asc' } })
  // An already-confirmed week, scored directly
  async function playedWeek(number: number, saturday: string, points: Record<string, number>) {
    const w = await createWeek({ seasonId: season.id, number, saturday, status: 'COMPLETED' })
    for (const [userId, p] of Object.entries(points)) {
      await prisma.weeklyStat.create({ data: { userId, weekId: w.id, seasonId: season.id, points: p } })
    }
    return w
  }

  it('is not decided mid-month', async () => {
    const [a] = await players(1)
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })   // week of Oct 3
    await confirmWeekResults(week.id)
    expect(await prisma.monthlyResult.count()).toBe(0)
    expect(await monthly()).toHaveLength(0)
  })

  it('is decided by the week on the month\'s last Saturday; a tie splits the pot and both get a monthly win', async () => {
    const [a, b, c] = await players(3)
    await playedWeek(2, '2026-10-24', { [a.id]: 3, [b.id]: 1, [c.id]: 0 })
    const oct31 = await createWeek({ seasonId: season.id, number: 3, saturday: '2026-10-31', status: 'LOCKED', games: GAMES })
    publishWeekToNhl(oct31, FINALS)
    await submitPicks(a.id, oct31, { TOR: 'MTL', BOS: 'BOS', EDM: 'EDM' })   // 1 -> 4 for October
    await submitPicks(b.id, oct31, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })   // 3 -> 4 for October
    await submitPicks(c.id, oct31, { TOR: 'TOR', BOS: 'BOS', EDM: 'CGY' })   // 1 -> 1

    expect(await confirmWeekResults(oct31.id)).toEqual({ success: true })

    // Pot: $5 x 2 weeks played in October, split two ways
    const pay = await monthly()
    expect(pay.map(p => [p.recipientId, p.amount, p.weekId])).toEqual(
      expect.arrayContaining([[a.id, 5, oct31.id], [b.id, 5, oct31.id]]))
    expect(pay).toHaveLength(2)
    expect(pay[0].description).toBe('October 2026 prize (split 2 ways)')

    const results = await prisma.monthlyResult.findMany({ where: { year: 2026, month: 10 } })
    expect(results).toHaveLength(3)
    expect(results.find(r => r.userId === c.id)).toMatchObject({ points: 1, isWinner: false, prizeAmount: 0 })
    expect(results.find(r => r.userId === a.id)).toMatchObject({ points: 4, isWinner: true, isSplit: true, prizeAmount: 5 })

    const wins = await prisma.seasonStat.findMany({ where: { seasonId: season.id } })
    expect(Object.fromEntries(wins.map(w => [w.userId, w.monthlyWins])))
      .toEqual({ [a.id]: 1, [b.id]: 1, [c.id]: 0 })
  })

  it('closes a month that never had a last-Saturday week when the next month starts', async () => {
    const [a, b] = await players(2)
    await playedWeek(2, '2026-10-24', { [a.id]: 2, [b.id]: 5 })   // no Oct 31 week
    const nov7 = await createWeek({ seasonId: season.id, number: 3, saturday: '2026-11-07', status: 'LOCKED', games: GAMES })
    publishWeekToNhl(nov7, FINALS)

    await confirmWeekResults(nov7.id)

    const pay = await monthly()
    expect(pay).toHaveLength(1)
    expect(pay[0]).toMatchObject({ recipientId: b.id, amount: 5, description: 'October 2026 winner' })
    expect(await prisma.monthlyResult.count({ where: { month: 11 } })).toBe(0)   // November still going
  })
})

describe('confirming safely', () => {
  it('refuses while any game is unfinished, and changes nothing', async () => {
    const [a] = await players(1)
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })
    publishWeekToNhl(week, { TOR: [4, 1], BOS: [2, 3] })   // EDM game not final

    expect(await confirmWeekResults(week.id)).toEqual({ success: false, error: 'Not all games are final yet' })
    expect((await prisma.week.findUniqueOrThrow({ where: { id: week.id } })).status).toBe('LOCKED')
    expect(await prisma.weeklyStat.count()).toBe(0)
    expect(await prisma.payment.count()).toBe(0)
  })

  it('a week can only be confirmed once', async () => {
    const [a] = await players(1)
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })

    expect((await confirmWeekResults(week.id)).success).toBe(true)
    expect(await confirmWeekResults(week.id)).toMatchObject({ success: false })

    expect(await prisma.payment.count({ where: { type: 'WEEKLY_WINNING' } })).toBe(1)
    expect((await prisma.seasonStat.findFirstOrThrow({ where: { userId: a.id } })).totalPoints).toBe(3)
  })

  it('two confirms at the same moment only process the week once', async () => {
    const [a, b] = await players(2)
    await submitPicks(a.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM' })
    await suicidePick(a.id, week.id, 'WINNER', 'TOR')
    await suicidePick(b.id, week.id, 'WINNER', 'NYR')

    const results = await Promise.all([confirmWeekResults(week.id), confirmWeekResults(week.id)])

    expect(results.filter(r => r.success)).toHaveLength(1)
    expect(await prisma.payment.count({ where: { type: 'WEEKLY_WINNING' } })).toBe(1)
    expect(await prisma.weeklyStat.count()).toBe(2)
    expect((await prisma.suicidePoolState.findFirstOrThrow({ where: { poolType: 'WINNER' } })).currentPot).toBe(5)
  })
})
