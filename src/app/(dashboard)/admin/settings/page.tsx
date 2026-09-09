import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/admin/SettingsClient'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/picks')

  const [settings, seasons, playerCount] = await Promise.all([
    prisma.settings.findFirst({ where: { id: 'default' } }),
    prisma.season.findMany({ orderBy: { startDate: 'desc' } }),
    prisma.user.count({ where: { isActive: true } }),
  ])

  if (!settings) redirect('/picks')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1">
          Configure pool rules, prize splits and email schedule
        </p>
      </div>
      <SettingsClient
        settings={settings}
        seasons={seasons}
        playerCount={playerCount}
      />
    </div>
  )
}