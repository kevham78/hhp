import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getWeekendGames, getUpcomingWeekend, formatDate } from '@/lib/api/nhl'
import { getOrCreateCurrentWeek } from '@/lib/db/weeks'
import { prisma } from '@/lib/db/prisma'
import PicksClient, { PicksState } from '@/components/picks/PicksClient'

export const dynamic = 'force-dynamic'

export default async function PicksPage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Check active season
  const season = await prisma.season.findFirst({ where: { isActive: true } })
  if (!season) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-white">My Picks 🏒</h1>
        <div className="hhp-card text-center py-12">
          <p className="text-4xl mb-3">🏒</p>
          <p className="text-white font-bold">Season Not Started</p>
          <p className="text-white/40 text-sm mt-1">
            The commissioner hasn't started the season yet. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  // Get weekend games from NHL API and current week from DB in parallel
  const [{ saturday, sunday }, weekData] = await Promise.all([
    getWeekendGames(),
    getOrCreateCurrentWeek(),
  ])

  if (!weekData) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/50">Unable to load this week's games. Try again shortly.</p>
      </div>
    )
  }

  // Load existing picks for this user
  const [existingPicks, existingSuicide] = await Promise.all([
    prisma.pick.findMany({
      where: { userId: session.user.id, weekId: weekData.id },
    }),
    prisma.suicidePick.findMany({
      where: { userId: session.user.id, weekId: weekData.id },
    }),
  ])

 // Shape existing picks into PicksState
// We need to map DB gameId back to NHL gameId for the UI
const picksState: PicksState = {
  picks: Object.fromEntries(
    existingPicks
    
      .map(p => {
        const game = weekData.games.find(g => g.id === p.gameId)
        return game ? [game.nhlGameId, p.pickedTeam] : null
      })
      .filter(Boolean) as [string, string][]
  ),
  tiebreakers: Object.fromEntries(
    existingPicks
      .filter(p => p.tiebreakerRank)
      .map(p => {
        const game = weekData.games.find(g => g.id === p.gameId)
        return game ? [game.nhlGameId, p.tiebreakerRank!] : null
      })
      .filter(Boolean) as [string, number][]
  ),
  suicide: {
    winner: (() => {
      const wp = existingSuicide.find(s => s.poolType === 'WINNER')
      if (!wp) return null
      // Find the NHL game ID where this team was picked
      const game = weekData.games.find(g =>
        g.homeTeamCode === wp.pickedTeam || g.awayTeamCode === wp.pickedTeam
      )
      return game ? game.nhlGameId : null
    })(),
    loser: (() => {
      const lp = existingSuicide.find(s => s.poolType === 'LOSER')
      if (!lp) return null
      // For loser, the stored team is the losing team — find its game
      const game = weekData.games.find(g =>
        g.homeTeamCode === lp.pickedTeam || g.awayTeamCode === lp.pickedTeam
      )
      return game ? game.nhlGameId : null
    })(),
  },
}
console.log('=== PICKS DEBUG ===')
console.log('Week games:', weekData.games.map(g => ({ id: g.id, nhlGameId: g.nhlGameId, home: g.homeTeamCode, away: g.awayTeamCode })))
console.log('Existing picks:', existingPicks.map(p => ({ gameId: p.gameId, team: p.pickedTeam, rank: p.tiebreakerRank })))
console.log('Existing suicide:', existingSuicide)


  const { saturday: satDate, sunday: sunDate } = getUpcomingWeekend()
  const isOpen = process.env.NODE_ENV === 'development' 
  ? true 
  : new Date() < new Date(weekData.picksDeadline)

  return (
    <PicksClient
      saturdayGames={saturday}
      sundayGames={sunday}
      saturdayDate={formatDate(satDate)}
      sundayDate={formatDate(sunDate)}
      weekId={weekData.id}
      deadline={weekData.picksDeadline.toISOString()}
      existingPicks={picksState}
      isOpen={isOpen}
    />
  )
}