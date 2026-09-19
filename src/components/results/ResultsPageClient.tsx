'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WeeklyPicksGrid from './WeeklyPicksGrid'

interface WeekOption {
  id:         string
  weekNumber: number
}

export default function ResultsPageClient({
  weeks,
  initialWeekId,
}: {
  weeks:         WeekOption[]
  initialWeekId: string
}) {
  const router = useRouter()
  const [weekId, setWeekId] = useState(initialWeekId)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setWeekId(next)
    router.push(`/results/week?weekId=${next}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Results</h1>
        <select
          value={weekId}
          onChange={handleChange}
          className="bg-hhp-navy border border-hhp-navy-light rounded-lg
                     px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-hhp-gold/50 transition-colors"
        >
          {weeks.map(w => (
            <option key={w.id} value={w.id}>Week {w.weekNumber}</option>
          ))}
        </select>
      </div>
      <WeeklyPicksGrid weekId={weekId} />
    </div>
  )
}
