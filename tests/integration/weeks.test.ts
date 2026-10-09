import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getOrCreateCurrentWeek, addMissingGames } from '@/lib/db/weeks'
import { getWeekendGames } from '@/lib/api/nhl'
import { prisma, createSettings, createSeason, createWeek, setNhlSchedule } from './db'

// Wednesday before week 2 (Sat Oct 10 / Sun Oct 11); week 1 already done
const WEDNESDAY = new Date('2026-10-07T16:00:00Z')

const SATURDAY = Array.from({ length: 13 }, (_, i) => ({
  id: `202602${String(i + 1).padStart(4, '0')}`, home: `H${i}`, away: `A${i}`, start: '2026-10-10T23:00:00Z',
}))
const SUNDAY = Array.from({ length: 5 }, (_, i) => ({
  id: `202602${String(i + 20).padStart(4, '0')}`, home: `S${i}`, away: `T${i}`, start: '2026-10-11T21:00:00Z',
}))

let seasonId: string

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY)
  await createSettings()
  seasonId = (await createSeason()).id
  await createWeek({ seasonId, number: 1, saturday: '2026-10-03', status: 'COMPLETED', published: true })
  setNhlSchedule('2026-10-10', SATURDAY)
  setNhlSchedule('2026-10-11', SUNDAY)
})

afterEach(() => vi.useRealTimers())

// What opening My Picks does on the server
async function openMyPicks() {
  const week = await getOrCreateCurrentWeek()
  const { saturday, sunday } = await getWeekendGames(new Date(week!.saturdayDate), new Date(week!.sundayDate))
  await addMissingGames(week!, saturday, sunday)
  return week!.id
}

describe('creating the week', () => {
  it('creates week 2 with each scheduled game once', async () => {
    await openMyPicks()
    const week = await prisma.week.findFirstOrThrow({ where: { weekNumber: 2 }, include: { games: true } })
    expect(week.games).toHaveLength(18)
    expect(week.games.filter(g => g.gameDay === 'SUNDAY')).toHaveLength(5)
  })

  it('players opening My Picks at the same moment never duplicate the week or its games (week 2 bug)', async () => {
    const weekIds = await Promise.all(Array.from({ length: 8 }, () => openMyPicks()))

    expect(new Set(weekIds).size).toBe(1)
    expect(await prisma.week.count({ where: { weekNumber: 2 } })).toBe(1)
    const games = await prisma.game.findMany({ where: { weekId: weekIds[0] } })
    expect(games).toHaveLength(18)
    expect(new Set(games.map(g => g.nhlGameId)).size).toBe(18)
  })

  it('the database refuses a second copy of the same game in a week', async () => {
    await openMyPicks()
    const game = await prisma.game.findFirstOrThrow({ where: { week: { weekNumber: 2 } } })
    const { id: _id, ...copy } = game
    await expect(prisma.game.create({ data: copy })).rejects.toThrow()
  })
})
