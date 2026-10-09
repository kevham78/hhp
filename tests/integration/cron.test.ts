import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runCommissionerNudge, runAutoApprove, runDeadlineJob } from '@/lib/cron/scheduler'
import { prisma, createSettings, createSeason, createUser, createPools, createWeek, publishWeekToNhl, submitPicks, suicidePick, sentEmails } from './db'

// Monday morning, after week 1's games (Sat Oct 3 / Sun Oct 4)
const MONDAY_5AM = new Date('2026-10-05T09:00:00Z')

let season: Awaited<ReturnType<typeof createSeason>>

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MONDAY_5AM)
  await createSettings()
  season = await createSeason()
  await createPools(season.id)
  await createUser({ name: 'Wayne', role: 'ADMIN', email: 'wayne@test.invalid' })
  await createUser({ name: 'Player', seasonId: season.id })
})

afterEach(() => vi.useRealTimers())

describe('commissioner "results ready to review" email', () => {
  it('goes to the commissioner for last weekend\'s locked week', async () => {
    await createWeek({ seasonId: season.id, status: 'LOCKED', published: true })

    await runCommissionerNudge()

    expect(sentEmails()).toEqual([expect.objectContaining({ to: 'wayne@test.invalid', subject: expect.stringContaining('Week 1') })])
  })

  it('is not sent once the results are already confirmed', async () => {
    await createWeek({ seasonId: season.id, status: 'COMPLETED', published: true })
    await runCommissionerNudge()
    expect(sentEmails()).toHaveLength(0)
  })

  it('is not sent before the weekend\'s games are over', async () => {
    vi.setSystemTime(new Date('2026-10-03T16:00:00Z'))   // Saturday
    await createWeek({ seasonId: season.id, status: 'LOCKED', published: true })
    await runCommissionerNudge()
    expect(sentEmails()).toHaveLength(0)
  })
})

describe('Monday auto-approve', () => {
  it('confirms last weekend\'s results when all games are final', async () => {
    const week = await createWeek({ seasonId: season.id, status: 'LOCKED', published: true,
      games: [{ home: 'TOR', away: 'MTL' }] })
    publishWeekToNhl(week, { TOR: [3, 2] })

    await runAutoApprove()

    expect((await prisma.week.findUniqueOrThrow({ where: { id: week.id } })).status).toBe('COMPLETED')
  })
})

describe('Friday deadline: auto-pick and the picks-are-in email', () => {
  it('links to Weekly Picks and tells auto-picked players, in bold', async () => {
    vi.setSystemTime(new Date('2026-10-02T18:00:00Z'))   // Fri 2pm EDT
    const week = await createWeek({ seasonId: season.id, games: [{ home: 'TOR', away: 'MTL' }, { home: 'BOS', away: 'NYR' }] })
    const done    = await createUser({ name: 'Done',    email: 'done@test.invalid',    seasonId: season.id })
    const nothing = await createUser({ name: 'Nothing', email: 'nothing@test.invalid', seasonId: season.id })
    const draft   = await createUser({ name: 'Draft',   email: 'draft@test.invalid',   seasonId: season.id })
    await submitPicks(done.id, week, { TOR: 'TOR', BOS: 'NYR' }, { TOR: 1, BOS: 2 })
    await suicidePick(done.id, week.id, 'WINNER', 'TOR')
    await suicidePick(done.id, week.id, 'LOSER', 'BOS')
    const tor = week.games.find(g => g.homeTeamCode === 'TOR')!
    await prisma.pick.create({ data: { userId: draft.id, weekId: week.id, gameId: tor.id, pickedTeam: 'MTL', isDraft: true } })

    await runDeadlineJob()

    const emailTo = (to: string) => sentEmails().find(e => e.to === to) as any
    for (const e of sentEmails() as any[]) {
      expect(e.html).toContain('http://test.local/weekly-picks')
      expect(e.html).not.toContain('/results/week')
    }
    expect(emailTo('done@test.invalid').html).not.toContain('auto-pick')
    expect(emailTo('nothing@test.invalid').html).toMatch(/<strong>Your picks were made by auto-pick this week/)
    expect(emailTo('draft@test.invalid').html).toMatch(/<strong>Some of your picks were filled in by auto-pick/)
  })
})
