import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import ProfileClient from '@/components/profile/ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      name:          true,
      email:         true,
      notifyByEmail: true,
      notifyInApp:   true,
      password:      true,
    },
  })

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-black text-white">My Profile</h1>
        <p className="text-white/40 text-sm mt-1">
          Update your name, notifications and password
        </p>
      </div>
      <ProfileClient
        name={user.name ?? ''}
        email={user.email ?? ''}
        notifyByEmail={user.notifyByEmail}
        notifyInApp={user.notifyInApp}
        hasPassword={!!user.password}
      />
    </div>
  )
}