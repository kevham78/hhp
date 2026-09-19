import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ResultsPageClient from '@/components/results/ResultsPageClient'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export default async function WeeklyResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { weekId: weekIdParam } = await searchParams

  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })

  // Only completed weeks show up here — a week isn't "done" until the
  // whole weekend has been played and the commissioner has confirmed it
  const completedWeeks = season
    ? await prisma.week.findMany({
        where:   { seasonId: season.id, status: 'COMPLETED' },
        orderBy: { weekNumber: 'desc' },
        select:  { id: true, weekNumber: true },
      })
    : []

  const weekId = weekIdParam && completedWeeks.some(w => w.id === weekIdParam)
    ? weekIdParam
    : completedWeeks[0]?.id

  if (!weekId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-white">Results</h1>
        <div className="hhp-card text-center py-16">
          <p className="text-4xl mb-4">⏳</p>
          <p className="text-white font-bold text-lg">No completed weeks yet</p>
          <p className="text-white/40 text-sm mt-2">
            Results show up here once a week's games are all played and
            the commissioner confirms the final scores. Check Weekly
            Picks for this week's live picks in the meantime.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ResultsPageClient weeks={completedWeeks} initialWeekId={weekId} />
  )
}
