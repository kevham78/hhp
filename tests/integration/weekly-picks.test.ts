import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/weekly-picks/route'
import { prisma, createSettings, createSeason, createUser, createWeek, submitPicks, asUser } from './db'

let season: Awaited<ReturnType<typeof createSeason>>

beforeEach(async () => {
  await createSettings()
  season = await createSeason()
  asUser(await createUser({ seasonId: season.id }))
})

const weeklyPicks = async () => (await GET()).json()

describe('GET /api/weekly-picks', () => {
  it('requires login', async () => {
    asUser(null)
    expect((await GET()).status).toBe(401)
  })

  it('hides picks before the deadline reveal', async () => {
    await createWeek({ seasonId: season.id, status: 'OPEN', published: false })
    expect(await weeklyPicks()).toEqual({ published: false })
  })

  it('shows everyone\'s picks once revealed', async () => {
    const week = await createWeek({ seasonId: season.id, status: 'LOCKED', published: true,
      games: [{ home: 'TOR', away: 'MTL' }] })
    const other = await createUser({ name: 'Other', seasonId: season.id })
    await submitPicks(other.id, week, { TOR: 'MTL' })

    const data = await weeklyPicks()
    expect(data).toMatchObject({ published: true, weekNumber: 1 })
    expect(data.playerResults).toHaveLength(2)
  })

  it('goes back to "not revealed" once the week is processed, until the next reveal', async () => {
    await createWeek({ seasonId: season.id, number: 1, status: 'COMPLETED', published: true })
    const week2 = await createWeek({ seasonId: season.id, number: 2, saturday: '2026-10-10', status: 'OPEN' })
    expect(await weeklyPicks()).toEqual({ published: false })

    await prisma.week.update({ where: { id: week2.id }, data: { status: 'LOCKED', picksPublished: true } })
    expect(await weeklyPicks()).toMatchObject({ published: true, weekNumber: 2 })
  })
})
