import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '@/app/api/picks/route'
import {
  prisma, createSettings, createSeason, createUser, createWeek, publishWeekToNhl,
  setNhlSchedule, asUser, post,
} from './db'

// Wednesday before week 1 (deadline Fri Oct 2, 2pm EDT)
const BEFORE_DEADLINE = new Date('2026-09-30T16:00:00Z')
const AFTER_DEADLINE  = new Date('2026-10-02T18:30:00Z')

let player: Awaited<ReturnType<typeof createUser>>
let week:   Awaited<ReturnType<typeof createWeek>>

const save = (body: object) => POST(post({
  picks: {}, tiebreakers: {}, suicide: { winner: null, loser: null }, isDraft: true, ...body,
}))
const storedPicks = () => prisma.pick.findMany({ where: { userId: player.id }, include: { game: true } })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_DEADLINE)
  await createSettings()
  const season = await createSeason()
  player = await createUser({ seasonId: season.id })
  week = await createWeek({
    seasonId: season.id,
    games: [{ home: 'TOR', away: 'MTL', nhlId: '9001' }, { home: 'BOS', away: 'NYR', nhlId: '9002', day: 'SUNDAY' }],
  })
  publishWeekToNhl(week)
  asUser(player)
})

afterEach(() => vi.useRealTimers())

describe('POST /api/picks', () => {
  it('requires login', async () => {
    asUser(null)
    expect((await save({})).status).toBe(401)
  })

  it('rejects malformed picks', async () => {
    expect((await save({ tiebreakers: { 9001: 7 } })).status).toBe(400)
    expect((await POST(post({ picks: 'nope' }))).status).toBe(400)
  })

  it('saves a draft, and saving again replaces it', async () => {
    expect((await save({ picks: { 9001: 'TOR', 9002: 'BOS' } })).status).toBe(200)
    expect((await save({ picks: { 9001: 'MTL', 9002: 'BOS' } })).status).toBe(200)

    const picks = await storedPicks()
    expect(picks).toHaveLength(2)
    expect(picks.find(p => p.game.nhlGameId === '9001')).toMatchObject({ pickedTeam: 'MTL', isDraft: true, submittedAt: null })
  })

  it('submits picks with tiebreakers and suicide picks', async () => {
    const res = await save({
      picks:       { 9001: 'TOR', 9002: 'NYR' },
      tiebreakers: { 9001: 1, 9002: 2 },
      // suicide picks are sent as game ids
      suicide:     { winner: '9001', loser: '9002' },
      isDraft:     false,
    })
    expect(res.status).toBe(200)

    const picks = await storedPicks()
    expect(picks.every(p => !p.isDraft && p.submittedAt)).toBe(true)
    expect(picks.find(p => p.game.nhlGameId === '9001')!.tiebreakerRank).toBe(1)

    const suicide = await prisma.suicidePick.findMany({ where: { userId: player.id } })
    // Winner pool = the team picked; loser pool = the opponent of the pick (NYR picked -> BOS)
    expect(suicide.find(s => s.poolType === 'WINNER')!.pickedTeam).toBe('TOR')
    expect(suicide.find(s => s.poolType === 'LOSER')!.pickedTeam).toBe('BOS')
  })

  it('ignores suicide picks for a pool the player is out of', async () => {
    await prisma.suicideStatus.updateMany({ where: { userId: player.id }, data: { loserPoolEliminated: true, loserPoolStrikes: 1 } })
    const res = await save({
      picks:       { 9001: 'TOR', 9002: 'NYR' },
      tiebreakers: { 9001: 1, 9002: 2 },
      suicide:     { winner: '9001', loser: '9002' },
      isDraft:     false,
    })
    expect(res.status).toBe(200)

    const suicide = await prisma.suicidePick.findMany({ where: { userId: player.id } })
    expect(suicide.map(s => s.poolType)).toEqual(['WINNER'])
  })

  it('refuses any change after the deadline — including drafts', async () => {
    vi.setSystemTime(AFTER_DEADLINE)
    expect((await save({ picks: { 9001: 'TOR' }, isDraft: false })).status).toBe(400)
    expect((await save({ picks: { 9001: 'TOR' }, isDraft: true })).status).toBe(400)
    expect(await storedPicks()).toHaveLength(0)
  })

  it('keeps picks for a game the NHL added after the week was created', async () => {
    // NHL schedule now has a third Saturday game we never stored
    setNhlSchedule('2026-10-03', [
      { id: '9001', home: 'TOR', away: 'MTL', start: '2026-10-03T23:00:00Z' },
      { id: '9003', home: 'EDM', away: 'CGY', start: '2026-10-04T02:00:00Z' },   // 10pm ET Saturday
    ])

    const res = await save({ picks: { 9001: 'TOR', 9002: 'BOS', 9003: 'EDM' } })
    expect(res.status).toBe(200)

    const picks = await storedPicks()
    expect(picks.map(p => p.game.nhlGameId).sort()).toEqual(['9001', '9002', '9003'])
    expect(await prisma.game.count({ where: { nhlGameId: '9003' } })).toBe(1)
  })

  it('ignores game ids that are not on this weekend\'s schedule', async () => {
    const res = await save({ picks: { 9001: 'TOR', 123456: 'XYZ' } })
    expect(res.status).toBe(200)
    expect((await storedPicks()).map(p => p.game.nhlGameId)).toEqual(['9001'])
    expect(await prisma.game.count({ where: { nhlGameId: '123456' } })).toBe(0)
  })
})
