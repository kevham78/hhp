import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import NHLStandingsClient from '@/components/standings/NHLStandingsClient'

export const dynamic = 'force-dynamic'

export default async function NHLStandingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">NHL Standings</h1>
        <p className="text-white/40 text-sm mt-1">
          How the real NHL teams are ranked this season.
        </p>
      </div>
      <NHLStandingsClient />
    </div>
  )
}
