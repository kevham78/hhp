import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import SuicideHistoryClient from '@/components/suicide/SuicideHistoryClient'

export const dynamic = 'force-dynamic'

export default async function SuicidePoolPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Suicide Pool</h1>
        <p className="text-white/40 text-sm mt-1">
          Everyone's winner and loser picks, week by week.
        </p>
      </div>
      <SuicideHistoryClient />
    </div>
  )
}
