import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import WeeklyPicksGrid from '@/components/results/WeeklyPicksGrid'
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

  // If no weekId provided, find the most recent published week
  let weekId = weekIdParam

  if (!weekId && season) {
    const latestWeek = await prisma.week.findFirst({
      where: {
        seasonId:       season.id,
        picksPublished: true,
      },
      orderBy: { weekNumber: 'desc' },
    })
    weekId = latestWeek?.id
  }

  if (!weekId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-white">Weekly Picks</h1>
        <div className="hhp-card text-center py-16">
          <p className="text-4xl mb-4">⏳</p>
          <p className="text-white font-bold text-lg">Waiting for submissions</p>
          <p className="text-white/40 text-sm mt-2">
            Picks will be revealed once everyone has submitted
            or the Friday deadline passes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Weekly Picks</h1>
      <WeeklyPicksGrid weekId={weekId} />
    </div>
  )
}