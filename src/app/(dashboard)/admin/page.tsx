import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/picks')

  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })

  const settings = await prisma.settings.findFirst({
    where: { id: 'default' },
  })

  // Current week
  const currentWeek = season
    ? await prisma.week.findFirst({
        where:   { seasonId: season.id, status: 'OPEN' },
        include: { games: true },
        orderBy: { weekNumber: 'desc' },
      })
    : null

  // All active players
  const players = await prisma.user.findMany({
    where: { isActive: true },
  })

  // Who has picked this week
  const submittedThisWeek = currentWeek
    ? await prisma.pick.findMany({
        where:    { weekId: currentWeek.id, isDraft: false },
        distinct: ['userId'],
        select:   { userId: true },
      })
    : []

  // Season standings
  const seasonStats = season
    ? await prisma.seasonStat.findMany({
        where:   { seasonId: season.id },
        include: { user: true },
        orderBy: { totalPoints: 'desc' },
        take:    5,
      })
    : []

  // Monthly pot
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  const completedWeeksThisMonth = season
    ? await prisma.week.count({
        where: {
          seasonId: season.id,
          status:   'COMPLETED',
          saturdayDate: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt:  new Date(currentYear, currentMonth, 1),
          },
        },
      })
    : 0

  const monthlyPot = completedWeeksThisMonth * (settings?.monthlyPrize ?? 5)

  // Suicide pool state
  const suicidePools = season
    ? await prisma.suicidePoolState.findMany({
        where: { seasonId: season.id },
      })
    : []

  // Recently completed week
  const lastCompletedWeek = season
    ? await prisma.week.findFirst({
        where:   { seasonId: season.id, status: 'COMPLETED' },
        orderBy: { weekNumber: 'desc' },
      })
    : null

  // All seasons for start season selector
  const allSeasons = await prisma.season.findMany({
    orderBy: { startDate: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">
          Commissioner Dashboard
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {season ? `${season.name} Season` : 'No active season'}
        </p>
      </div>

      <AdminDashboardClient
        season={season}
        allSeasons={allSeasons}
        currentWeek={currentWeek ? {
          id:         currentWeek.id,
          weekNumber: currentWeek.weekNumber,
          deadline:   currentWeek.picksDeadline.toISOString(),
          gamesCount: currentWeek.games.length,
        } : null}
        players={players.map(p => ({
          id:   p.id,
          name: p.name ?? '',
        }))}
        submittedUserIds={submittedThisWeek.map(p => p.userId)}
        seasonStats={seasonStats.map(s => ({
          userId:      s.userId,
          name:        s.user?.name ?? '',
          totalPoints: s.totalPoints,
          weeklyWins:  s.weeklyWins,
        }))}
        monthlyPot={monthlyPot}
        suicidePots={{
          winner: suicidePools.find(p => p.poolType === 'WINNER')?.currentPot ?? 0,
          loser:  suicidePools.find(p => p.poolType === 'LOSER')?.currentPot  ?? 0,
        }}
        lastCompletedWeekId={lastCompletedWeek?.id ?? null}
        settings={settings ? {
          weeklyDues:  settings.weeklyDues,
          weeklyPrize: settings.weeklyPrize,
        } : null}
      />
    </div>
  )
}