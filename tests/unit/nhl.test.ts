import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatDate, toEasternDateStr, getCurrentNHLSeasonCode, getUpcomingWeekend,
  getWeekendGames, getWeekendResults, getStandings,
} from '@/lib/api/nhl'
import { loadFixture } from './fixtures'

// The NHL API is replaced by recorded responses (tests/fixtures/nhl)
let schedule: Record<string, any> = {}
let standings: any = null

beforeEach(() => {
  schedule = {}
  standings = null
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input)
    const day = url.match(/\/schedule\/(\d{4}-\d{2}-\d{2})/)?.[1]
    if (day) return new Response(JSON.stringify(schedule[day] ?? { gameWeek: [] }))
    if (url.includes('/standings/')) return new Response(JSON.stringify(standings ?? { standings: [] }))
    throw new Error(`unexpected fetch ${url}`)
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('dates', () => {
  it('formatDate reads stored calendar dates in UTC', () => {
    expect(formatDate(new Date('2026-10-03T00:00:00Z'))).toBe('2026-10-03')
  })

  it('toEasternDateStr: a late game Saturday night is still Saturday in Eastern time', () => {
    expect(toEasternDateStr(new Date('2026-10-04T02:30:00Z'))).toBe('2026-10-03')   // 10:30pm EDT
    expect(toEasternDateStr(new Date('2026-11-08T04:30:00Z'))).toBe('2026-11-07')   // 11:30pm EST
  })

  it('NHL season code rolls over in July', () => {
    expect(getCurrentNHLSeasonCode(new Date('2026-06-30T12:00:00Z'))).toBe('20252026')
    expect(getCurrentNHLSeasonCode(new Date('2026-07-01T12:00:00Z'))).toBe('20262027')
  })

  it.each([
    ['Wednesday', '2026-09-30T16:00:00Z', '2026-10-03'],
    ['Friday night (Eastern)', '2026-10-03T03:00:00Z', '2026-10-03'],   // Fri 11pm EDT
    ['Saturday', '2026-10-03T16:00:00Z', '2026-10-03'],
    ['Sunday keeps the current weekend', '2026-10-04T22:00:00Z', '2026-10-03'],
    ['Monday moves to the next weekend', '2026-10-05T14:00:00Z', '2026-10-10'],
  ])('upcoming weekend on %s', (_label, now, expectedSaturday) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    const { saturday, sunday } = getUpcomingWeekend()
    expect(formatDate(saturday)).toBe(expectedSaturday)
    expect(sunday.getTime() - saturday.getTime()).toBe(24 * 3600_000)
  })
})

describe('schedule', () => {
  it('returns the weekend\'s regular-season games from the real API shape', async () => {
    schedule['2026-10-03'] = loadFixture('schedule-2026-10-03.json')
    schedule['2026-10-04'] = loadFixture('schedule-2026-10-04.json')

    const { saturday, sunday } = await getWeekendGames(
      new Date('2026-10-03T00:00:00Z'), new Date('2026-10-04T00:00:00Z'))

    expect(saturday).toHaveLength(13)
    expect(sunday).toHaveLength(5)
    expect(saturday[0]).toHaveProperty('homeTeam.abbrev')
  })

  it('drops preseason games and games that start on a different Eastern date', async () => {
    const day = loadFixture('schedule-2026-10-03.json')
    const games = day.gameWeek[0].games
    games[0].gameType = 1      // preseason: still pickable
    games[1].gameType = 3      // playoffs: not part of the pool
    games[2].startTimeUTC = '2026-10-03T02:00:00Z'   // Friday 10pm EDT
    schedule['2026-10-03'] = day

    const { saturday } = await getWeekendGames(new Date('2026-10-03T00:00:00Z'), new Date('2026-10-04T00:00:00Z'))

    const ids = saturday.map(g => g.id)
    expect(ids).toContain(games[0].id)
    expect(ids).not.toContain(games[1].id)
    expect(ids).not.toContain(games[2].id)
    expect(saturday).toHaveLength(11)
  })

  it('returns no games (not an error) when the NHL API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 503 })))
    expect(await getWeekendGames(new Date('2026-10-03T00:00:00Z'), new Date('2026-10-04T00:00:00Z')))
      .toEqual({ saturday: [], sunday: [] })
  })
})

describe('results', () => {
  it('reads final scores from a finished game day', async () => {
    schedule['2026-04-11'] = loadFixture('schedule-2026-04-11.json')
    const results = await getWeekendResults(new Date('2026-04-11T00:00:00Z'), new Date('2026-04-12T00:00:00Z'))
    expect(results).toHaveLength(15)
    expect(results.every(r => r.isFinal && !r.isLive)).toBe(true)
    expect(typeof results[0].homeScore).toBe('number')
  })

  it('treats both FINAL and OFF as final, and LIVE as not', async () => {
    const day = loadFixture('schedule-2026-04-11.json')
    const [a, b, c] = day.gameWeek[0].games
    a.gameState = 'FINAL'; b.gameState = 'LIVE'; c.gameState = 'FUT'
    schedule['2026-04-11'] = day

    const results = await getWeekendResults(new Date('2026-04-11T00:00:00Z'), new Date('2026-04-12T00:00:00Z'))
    const byId = (g: any) => results.find(r => r.nhlGameId === String(g.id))!
    expect(byId(a)).toMatchObject({ isFinal: true, isLive: false })
    expect(byId(b)).toMatchObject({ isFinal: false, isLive: true })
    expect(byId(c)).toMatchObject({ isFinal: false, isLive: false })
  })
})

describe('standings', () => {
  it('passes through the season-start standings (teams with no games yet)', async () => {
    standings = loadFixture('standings-2026-09-30.json')
    const teams = await getStandings()
    expect(teams).toHaveLength(32)
    expect(teams.some(t => t.pointPctg === undefined)).toBe(true)
  })
})
