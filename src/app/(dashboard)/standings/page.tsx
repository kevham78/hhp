import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import StandingsClient from '@/components/standings/StandingsClient'

export const dynamic = 'force-dynamic'

export default async function StandingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Standings 📊</h1>
        <p className="text-white/40 text-sm mt-1">
          Season standings and weekly history
        </p>
      </div>
      <StandingsClient />
    </div>
  )
}