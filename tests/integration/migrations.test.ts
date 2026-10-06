import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  prisma, createSeason, createUser, createWeek, suicidePick, status,
} from './db'

// Data migrations: run the migration's SQL again on data set up the way
// production looked before it, and check what it changed.
async function runMigration(name: string) {
  const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8')
    .replace(/^--.*$/gm, '')
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement)
  }
}

describe('20261006120000_winner_pool_two_strikes', () => {
  it('reinstates one-strike winner-pool players and removes picks for pools a player is out of', async () => {
    const season = await createSeason()
    const week1  = await createWeek({ seasonId: season.id, number: 1, saturday: '2026-10-03', status: 'COMPLETED' })
    const week2  = await createWeek({ seasonId: season.id, number: 2, saturday: '2026-10-10' })

    const winnerOut = await createUser({ seasonId: season.id })   // 1 wrong winner pick in week 1
    const loserOut  = await createUser({ seasonId: season.id })   // 1 wrong loser pick in week 1
    const alive     = await createUser({ seasonId: season.id })
    const set = (userId: string, data: object) =>
      prisma.suicideStatus.update({ where: { userId_seasonId: { userId, seasonId: season.id } }, data })
    await set(winnerOut.id, { winnerPoolEliminated: true, winnerPoolStrikes: 1 })
    await set(loserOut.id,  { loserPoolEliminated:  true, loserPoolStrikes:  1 })

    // Week 1, graded: the picks that knocked them out
    const graded = await suicidePick(loserOut.id, week1.id, 'LOSER', 'TOR')
    await prisma.suicidePick.update({ where: { id: graded.id }, data: { isCorrect: false } })

    // Week 2, ungraded: everyone was made to pick both pools
    for (const p of [winnerOut, loserOut, alive]) {
      await suicidePick(p.id, week2.id, 'WINNER', 'EDM')
      await suicidePick(p.id, week2.id, 'LOSER',  'CGY')
    }

    await runMigration('20261006120000_winner_pool_two_strikes')

    expect(await status(winnerOut.id, season.id)).toMatchObject({ winnerPoolEliminated: false, winnerPoolStrikes: 1 })
    expect(await status(loserOut.id,  season.id)).toMatchObject({ loserPoolEliminated: true })

    const week2Picks = async (userId: string) =>
      (await prisma.suicidePick.findMany({ where: { userId, weekId: week2.id } })).map(p => p.poolType).sort()
    expect(await week2Picks(winnerOut.id)).toEqual(['LOSER', 'WINNER'])   // back in, so the winner pick counts
    expect(await week2Picks(loserOut.id)).toEqual(['WINNER'])             // loser pick removed
    expect(await week2Picks(alive.id)).toEqual(['LOSER', 'WINNER'])

    // The graded week 1 pick stays as history
    expect(await prisma.suicidePick.findUnique({ where: { id: graded.id } })).not.toBeNull()
  })
})
