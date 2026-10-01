import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StandingsTable } from '@/components/standings/NHLStandingsClient'
import { loadFixture } from './fixtures'

describe('NHL standings table', () => {
  // Day 2 of the 2026-27 season: 20 of 32 teams haven't played, so the
  // NHL API leaves out pointPctg and streak for them. This used to crash.
  const teams = loadFixture('standings-2026-09-30.json').standings

  it('renders every team when some have not played yet', () => {
    const html = renderToString(<StandingsTable teams={teams} />)
    expect(html.match(/<tr/g)).toHaveLength(teams.length + 1)   // + header row
  })

  it('shows .000 and a dash for a team with no games', () => {
    const noGames = teams.find((t: any) => t.pointPctg === undefined)
    const html = renderToString(<StandingsTable teams={[noGames]} />)
    expect(html).toContain('0.000')
    expect(html).toContain('—')
  })
})
