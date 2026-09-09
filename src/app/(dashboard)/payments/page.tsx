import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import PaymentsClient from '@/components/payments/PaymentsClient'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Money 💰</h1>
        <p className="text-white/40 text-sm mt-1">
          Pool finances, standings and payment history
        </p>
      </div>
      <PaymentsClient isAdmin={session.user.role === 'ADMIN'} />
    </div>
  )
}