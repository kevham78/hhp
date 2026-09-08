import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import ResultsClient from '@/components/admin/ResultsClient'

export const dynamic = 'force-dynamic'

export default async function AdminResultsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/picks')

  // Get current active week
  const season = await prisma.season.findFirst({ where: { isActive: true } })
  if (!season) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/50">No active season.</p>
      </div>
    )
  }

  const week = await prisma.week.findFirst({
    where:   { seasonId: season.id, status: { not: 'COMPLETED' } },
    include: { games: true },
    orderBy: { weekNumber: 'desc' },
  })

  if (!week) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-white">Results</h1>
        <div className="hhp-card text-center py-12">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-white font-bold">All weeks are complete!</p>
          <p className="text-white/40 text-sm mt-1">No pending results to review.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Results</h1>
        <p className="text-white/40 text-sm mt-1">
          Week {week.weekNumber} · Review and confirm results
        </p>
      </div>
      <ResultsClient weekId={week.id} games={week.games} />
    </div>
  )
}