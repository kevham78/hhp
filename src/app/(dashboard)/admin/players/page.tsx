import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import PlayersClient from '@/components/admin/PlayersClient'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/picks')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Players</h1>
        <p className="text-white/40 text-sm mt-1">
          Manage pool members and send invites
        </p>
      </div>
      <PlayersClient />
    </div>
  )
}