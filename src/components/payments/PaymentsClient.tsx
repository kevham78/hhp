'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Trophy, Plus, X } from 'lucide-react'

interface Transaction {
  id:          string
  date:        string
  type:        string
  amount:      number
  description: string
  weekNumber:  number | null
}

interface PlayerFinancial {
  userId:        string
  name:          string
  image:         string | null
  duesOwed:      number
  winnings:      number
  paid:          number
  netBalance:    number
  monthlyPoints: number
  monthlyWins:   number
  transactions:  Transaction[]
}

interface PaymentsData {
  seasonId:         string
  completedWeeks:   number
  weeklyDues:       number
  playerFinancials: PlayerFinancial[]
  monthlyStandings: PlayerFinancial[]
  monthlyPot:       number
  currentMonth:     number
  currentYear:      number
  suicidePots: {
    winner: number
    loser:  number
  }
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function typeLabel(type: string): string {
  switch (type) {
    case 'WEEKLY_WINNING':  return '🏆 Weekly Win'
    case 'MONTHLY_WINNING': return '📅 Monthly Win'
    case 'SUICIDE_WINNING': return '☠️ Suicide Pool'
    case 'DUES_PAID':       return '💵 Payment'
    default:                return type
  }
}

export default function PaymentsClient({ isAdmin }: { isAdmin: boolean }) {
  const [data,           setData]           = useState<PaymentsData | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  // Payment modal
  const [showPayment,  setShowPayment]  = useState(false)
  const [payingPlayer, setPayingPlayer] = useState<PlayerFinancial | null>(null)
  const [payAmount,    setPayAmount]    = useState('')
  const [payNote,      setPayNote]      = useState('')
  const [paying,       setPaying]       = useState(false)
  const [payMsg,       setPayMsg]       = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res  = await fetch('/api/payments')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to load financials')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payingPlayer) return
    setPaying(true)
    setPayMsg('')
    try {
      const res  = await fetch('/api/payments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          playerId: payingPlayer.userId,
          amount:   parseFloat(payAmount),
          note:     payNote,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPayMsg(`Payment of $${payAmount} logged for ${payingPlayer.name}`)
      setPayAmount('')
      setPayNote('')
      await loadData()
      setTimeout(() => {
        setShowPayment(false)
        setPayingPlayer(null)
        setPayMsg('')
      }, 2000)
    } catch (err: any) {
      setPayMsg(err.message || 'Failed to log payment')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/40">Loading financials...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">

      {/* ── POT SUMMARY ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="hhp-card text-center">
          <p className="text-white/40 text-xs mb-1">Monthly Pot</p>
          <p className="text-hhp-gold font-black text-xl">
            ${data.monthlyPot.toFixed(2)}
          </p>
          <p className="text-white/30 text-xs mt-1">
            {MONTH_NAMES[data.currentMonth]}
          </p>
        </div>
        <div className="hhp-card text-center">
          <p className="text-white/40 text-xs mb-1">Suicide Winner</p>
          <p className="text-green-400 font-black text-xl">
            ${data.suicidePots.winner.toFixed(2)}
          </p>
          <p className="text-white/30 text-xs mt-1">Rolling pot</p>
        </div>
        <div className="hhp-card text-center">
          <p className="text-white/40 text-xs mb-1">Suicide Loser</p>
          <p className="text-red-400 font-black text-xl">
            ${data.suicidePots.loser.toFixed(2)}
          </p>
          <p className="text-white/30 text-xs mt-1">Rolling pot</p>
        </div>
        <div className="hhp-card text-center">
          <p className="text-white/40 text-xs mb-1">Weeks Played</p>
          <p className="text-white font-black text-xl">{data.completedWeeks}</p>
          <p className="text-white/30 text-xs mt-1">
            ${data.weeklyDues}/week
          </p>
        </div>
      </div>

      {/* ── MONTHLY STANDINGS ────────────────── */}
      <div className="hhp-card">
        <h2 className="text-white font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-hhp-gold" />
          {MONTH_NAMES[data.currentMonth]} Standings
          <span className="text-white/30 text-sm font-normal ml-1">
            (pot: ${data.monthlyPot.toFixed(2)})
          </span>
        </h2>
        <div className="space-y-2">
          {data.monthlyStandings.map((player, i) => (
            <div key={player.userId}
                 className="flex items-center gap-3 py-2 border-b
                            border-hhp-navy-light/50 last:border-0">
              <span className="text-white/30 text-sm w-5 text-center">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{player.name}</p>
              </div>
              <span className="text-white font-black">
                {player.monthlyPoints} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── PLAYER BALANCES ──────────────────── */}
      <div className="hhp-card">
        <h2 className="text-white font-bold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-hhp-gold" />
          Player Balances
        </h2>

        <div className="space-y-2">
          {data.playerFinancials.map(player => {
            const isExpanded = expandedPlayer === player.userId
            const owes       = player.netBalance > 0
            const even       = Math.abs(player.netBalance) < 0.01

            return (
              <div key={player.userId}
                   className="border border-hhp-navy-light rounded-xl overflow-hidden">

                {/* Player row */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer
                             hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedPlayer(
                    isExpanded ? null : player.userId
                  )}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-hhp-navy-light
                                  border border-hhp-gold/30 flex-shrink-0
                                  flex items-center justify-center">
                    <span className="text-hhp-gold text-xs font-bold">
                      {player.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">
                      {player.name}
                    </p>
                    <p className="text-white/30 text-xs">
                      {data.completedWeeks} weeks ×
                      ${data.weeklyDues} = ${player.duesOwed.toFixed(2)} dues
                    </p>
                  </div>

                  {/* Balance */}
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-sm ${
                      even  ? 'text-white/40' :
                      owes  ? 'text-red-400'  : 'text-green-400'
                    }`}>
                      {even
                        ? 'Even'
                        : owes
                          ? `-$${player.netBalance.toFixed(2)}`
                          : `+$${Math.abs(player.netBalance).toFixed(2)}`}
                    </p>
                    <p className="text-white/30 text-xs">
                      {even
                        ? 'all square'
                        : owes
                          ? 'owes commissioner'
                          : 'commissioner owes'}
                    </p>
                  </div>

                  {/* Log payment button — admin only */}
                  {isAdmin && owes && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setPayingPlayer(player)
                        setPayAmount(player.netBalance.toFixed(2))
                        setShowPayment(true)
                      }}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5
                                 rounded-lg bg-hhp-gold/15 text-hhp-gold text-xs
                                 font-bold hover:bg-hhp-gold/25 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Payment
                    </button>
                  )}
                </div>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <div className="border-t border-hhp-navy-light bg-hhp-navy/50 p-3">

                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                      <div>
                        <p className="text-white/40 text-xs">Dues Owed</p>
                        <p className="text-white font-bold text-sm">
                          ${player.duesOwed.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Winnings</p>
                        <p className="text-green-400 font-bold text-sm">
                          ${player.winnings.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Paid</p>
                        <p className="text-hhp-gold font-bold text-sm">
                          ${player.paid.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Transaction history */}
                    {player.transactions.length === 0 ? (
                      <p className="text-white/30 text-xs text-center py-2">
                        No transactions yet
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-white/30 text-xs font-semibold
                                      uppercase tracking-widest mb-2">
                          History
                        </p>
                        {player.transactions.map(tx => (
                          <div key={tx.id}
                               className="flex items-center gap-2 text-xs">
                            <span className="text-white/30 w-20 flex-shrink-0">
                              {new Date(tx.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day:   'numeric',
                              })}
                            </span>
                            <span className="text-white/60 flex-1">
                              {typeLabel(tx.type)}
                              {tx.weekNumber
                                ? ` — Wk ${tx.weekNumber}`
                                : ''}
                            </span>
                            <span className={`font-bold flex-shrink-0 ${
                              tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {tx.amount > 0 ? '+' : ''}
                              ${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── LOG PAYMENT MODAL ────────────────── */}
      {showPayment && payingPlayer && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40"
               onClick={() => setShowPayment(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="hhp-card hhp-gold-border w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">Log Payment</h2>
                <button
                  onClick={() => setShowPayment(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-white/60 text-sm mb-4">
                Recording payment from{' '}
                <span className="text-white font-semibold">
                  {payingPlayer.name}
                </span>
              </p>

              {payMsg && (
                <div className={`p-3 rounded-lg text-sm mb-4 ${
                  payMsg.includes('Failed')
                    ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                    : 'bg-green-500/15 border border-green-500/30 text-green-400'
                }`}>
                  {payMsg}
                </div>
              )}

              <form onSubmit={handleLogPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium
                                    text-white/70 mb-1.5">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    required
                    className="w-full bg-hhp-navy border border-hhp-navy-light
                               rounded-lg px-4 py-2.5 text-white
                               focus:outline-none focus:border-hhp-gold/50
                               transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium
                                    text-white/70 mb-1.5">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={e => setPayNote(e.target.value)}
                    placeholder="e.g. Cash at family dinner"
                    className="w-full bg-hhp-navy border border-hhp-navy-light
                               rounded-lg px-4 py-2.5 text-white
                               placeholder-white/25
                               focus:outline-none focus:border-hhp-gold/50
                               transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={paying}
                    className="flex-1 py-2.5 rounded-lg bg-hhp-gold
                               text-hhp-navy font-bold hover:bg-hhp-gold-light
                               disabled:opacity-50 transition-colors"
                  >
                    {paying ? 'Saving...' : 'Log Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPayment(false)}
                    className="px-4 py-2.5 rounded-lg border border-hhp-navy-light
                               text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}