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
  const picksState: PicksState = {
    picks: Object.fromEntries(
      existingPicks.map(p => [p.gameId, p.pickedTeam])
    ),
    tiebreakers: Object.fromEntries(
      existingPicks
        .filter(p => p.tiebreakerRank)
        .map(p => [p.gameId, p.tiebreakerRank!])
    ),
    suicide: {
      winner: existingSuicide.find(s => s.poolType === 'WINNER')?.pickedTeam ?? null,
      loser:  existingSuicide.find(s => s.poolType === 'LOSER')?.pickedTeam  ?? null,
    },
  }

  const { saturday: satDate, sunday: sunDate } = getUpcomingWeekend()
  const isOpen = new Date() < new Date(weekData.picksDeadline)

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