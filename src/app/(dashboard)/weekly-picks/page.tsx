import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import WeeklyPicksLiveClient from '@/components/weekly-picks/WeeklyPicksLiveClient'

export const dynamic = 'force-dynamic'

export default async function WeeklyPicksPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Weekly Picks</h1>
        <p className="text-white/40 text-sm mt-1">
          Everyone's picks for this week — scores fill in as games finish.
        </p>
      </div>
      <WeeklyPicksLiveClient />
    </div>
  )
}
