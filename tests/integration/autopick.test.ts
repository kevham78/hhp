import { describe, it, expect, beforeEach } from 'vitest'
import { runAutoPick } from '@/lib/cron/autopick'
import { prisma, createSettings, createSeason, createUser, createWeek, submitPicks, suicidePick } from './db'

// Runs at the Friday deadline: fills in whatever each player didn't pick,
// then locks and reveals the week.

const GAMES = [
  { home: 'TOR', away: 'MTL' }, { home: 'BOS', away: 'NYR' },
  { home: 'EDM', away: 'CGY' }, { home: 'VAN', away: 'SEA' },
]

let season: Awaited<ReturnType<typeof createSeason>>
let week:   Awaited<ReturnType<typeof createWeek>>

beforeEach(async () => {
  await createSettings()
  season = await createSeason()
  week = await createWeek({ seasonId: season.id, games: GAMES })
})

const picksOf   = (userId: string) => prisma.pick.findMany({ where: { userId, weekId: week.id }, include: { game: true } })
const suicideOf = (userId: string) => prisma.suicidePick.findMany({ where: { userId, weekId: week.id } })

describe('runAutoPick', () => {
  it('gives a player who picked nothing a complete, valid set of picks', async () => {
    const p = await createUser({ seasonId: season.id })

    await runAutoPick(week.id)

    const picks = await picksOf(p.id)
    expect(picks).toHaveLength(GAMES.length)
    for (const pick of picks) {
      expect([pick.game.homeTeamCode, pick.game.awayTeamCode]).toContain(pick.pickedTeam)
      expect(pick).toMatchObject({ isAutoPickd: true, isDraft: false })
    }
    expect(picks.map(x => x.tiebreakerRank).filter(Boolean).sort()).toEqual([1, 2, 3])

    const suicide = await suicideOf(p.id)
    const winner = suicide.find(s => s.poolType === 'WINNER')!
    const loser  = suicide.find(s => s.poolType === 'LOSER')!
    // Winner pick must be a team they picked; loser pick must be the opponent of one
    expect(picks.map(x => x.pickedTeam)).toContain(winner.pickedTeam)
    const opponents = picks.map(x => x.pickedTeam === x.game.homeTeamCode ? x.game.awayTeamCode : x.game.homeTeamCode)
    expect(opponents).toContain(loser.pickedTeam)
  })

  it('leaves a complete submission alone', async () => {
    const p = await createUser({ seasonId: season.id })
    await submitPicks(p.id, week, { TOR: 'TOR', BOS: 'NYR', EDM: 'EDM', VAN: 'SEA' }, { TOR: 1, BOS: 2, EDM: 3 })
    await suicidePick(p.id, week.id, 'WINNER', 'TOR')
    await suicidePick(p.id, week.id, 'LOSER', 'BOS')

    await runAutoPick(week.id)

    const picks = await picksOf(p.id)
    expect(picks.map(x => x.pickedTeam).sort()).toEqual(['EDM', 'NYR', 'SEA', 'TOR'])
    expect(picks.some(x => x.isAutoPickd)).toBe(false)
    expect((await suicideOf(p.id)).map(s => s.pickedTeam).sort()).toEqual(['BOS', 'TOR'])
  })

  it('fills only the gaps in a draft and submits it', async () => {
    const p = await createUser({ seasonId: season.id })
    const tor = week.games.find(g => g.homeTeamCode === 'TOR')!
    await prisma.pick.create({ data: { userId: p.id, weekId: week.id, gameId: tor.id, pickedTeam: 'MTL', isDraft: true } })

    await runAutoPick(week.id)

    const picks = await picksOf(p.id)
    expect(picks).toHaveLength(GAMES.length)
    expect(picks.find(x => x.gameId === tor.id)).toMatchObject({ pickedTeam: 'MTL', isAutoPickd: false, isDraft: false })
  })

  it('never auto-picks a suicide team the player already used this season', async () => {
    const p = await createUser({ seasonId: season.id })
    // Every home team already used in the winner pool
    await prisma.suicideStatus.update({
      where: { userId_seasonId: { userId: p.id, seasonId: season.id } },
      data:  { winnerTeamsUsed: ['TOR', 'BOS', 'EDM', 'VAN'] },
    })
    await submitPicks(p.id, week, { TOR: 'TOR', BOS: 'BOS', EDM: 'EDM', VAN: 'VAN' }, { TOR: 1, BOS: 2, EDM: 3 })

    await runAutoPick(week.id)

    expect((await suicideOf(p.id)).find(s => s.poolType === 'WINNER')).toBeUndefined()
  })

  it('skips the suicide pick for a pool the player is already out of', async () => {
    const p = await createUser({ seasonId: season.id })
    await prisma.suicideStatus.update({
      where: { userId_seasonId: { userId: p.id, seasonId: season.id } },
      data:  { loserPoolEliminated: true, loserPoolStrikes: 1 },
    })

    await runAutoPick(week.id)

    const pools = (await suicideOf(p.id)).map(s => s.poolType)
    expect(pools).toEqual(['WINNER'])
  })

  it('locks and reveals the week', async () => {
    await runAutoPick(week.id)
    expect(await prisma.week.findUniqueOrThrow({ where: { id: week.id } }))
      .toMatchObject({ status: 'LOCKED', picksPublished: true })
  })
})
