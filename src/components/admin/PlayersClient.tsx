'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Shield, User, CheckCircle, Clock, XCircle } from 'lucide-react'

interface Player {
  id:            string
  name:          string
  email:         string
  role:          string
  isActive:      boolean
  image:         string | null
  totalPoints:   number
  weeklyWins:    number
  monthlyWins:   number
  hasPicked:     boolean
  currentWeekId: string | null
}

export default function PlayersClient() {
  const [players,  setPlayers]  = useState<Player[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showInvite, setShowInvite] = useState(false)

  // Invite form
  const [inviteName,  setInviteName]  = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting,    setInviting]    = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    success:   boolean
    message:   string
    inviteUrl?: string
    emailSent?: boolean
  } | null>(null)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/players')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlayers(data.players)
    } catch (err: any) {
      setError(err.message || 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteResult(null)
    try {
      const res  = await fetch('/api/admin/players', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'invite',
          email:  inviteEmail,
          name:   inviteName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteResult(data)
      setInviteName('')
      setInviteEmail('')
    } catch (err: any) {
      setInviteResult({
        success: false,
        message: err.message || 'Failed to send invite',
      })
    } finally {
      setInviting(false)
    }
  }

  async function handleToggle(userId: string, isActive: boolean) {
    try {
      const res = await fetch('/api/admin/players', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'toggle', userId, isActive }),
      })
      if (!res.ok) throw new Error('Failed to update player')
      setPlayers(prev =>
        prev.map(p => p.id === userId ? { ...p, isActive } : p)
      )
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="hhp-card text-center py-12">
        <p className="text-white/40">Loading players...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {error && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{players.length} players in pool</p>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteResult(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-hhp-red
                     hover:bg-hhp-red-dark text-white text-sm font-bold transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Player
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="hhp-card hhp-gold-border space-y-4">
          <h2 className="text-white font-bold">Send Invite</h2>

          {inviteResult && (
            <div className={`p-3 rounded-lg text-sm ${
              inviteResult.success
                ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                : 'bg-red-500/15 border border-red-500/30 text-red-400'
            }`}>
              <p className="font-medium">{inviteResult.message}</p>
              {inviteResult.success && inviteResult.inviteUrl && (
                <div className="mt-2">
                  {inviteResult.emailSent ? (
                    <p className="text-xs opacity-75">
                      ✅ Email sent successfully!
                    </p>
                  ) : (
                    <div>
                      <p className="text-xs opacity-75 mb-1">
                        Share this link manually:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-black/20 px-2 py-1 rounded
                                         flex-1 truncate">
                          {inviteResult.inviteUrl}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl!)}
                          className="text-xs px-2 py-1 rounded bg-white/10
                                     hover:bg-white/20 transition-colors flex-shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Player Name
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="First name is fine"
                required
                className="w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                           px-4 py-2.5 text-white placeholder-white/25
                           focus:outline-none focus:border-hhp-gold/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="player@example.com"
                required
                className="w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                           px-4 py-2.5 text-white placeholder-white/25
                           focus:outline-none focus:border-hhp-gold/50 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={inviting}
                className="flex-1 py-2.5 rounded-lg bg-hhp-gold text-hhp-navy
                           font-bold hover:bg-hhp-gold-light disabled:opacity-50
                           transition-colors"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2.5 rounded-lg border border-hhp-navy-light
                           text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Players list */}
      <div className="space-y-3">
        {players.map(player => (
          <div
            key={player.id}
            className={`hhp-card flex items-center gap-4 ${
              !player.isActive ? 'opacity-50' : ''
            }`}
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-hhp-navy-light border
                            border-hhp-gold/30 flex items-center justify-center
                            flex-shrink-0">
              {player.image ? (
                <img
                  src={player.image}
                  alt={player.name ?? ''}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-hhp-gold font-bold">
                  {player.name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold truncate">{player.name}</p>
                {player.role === 'ADMIN' && (
                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5
                                   rounded bg-hhp-gold/15 text-hhp-gold">
                    <Shield className="w-3 h-3" /> Commissioner
                  </span>
                )}
                {!player.isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded
                                   bg-white/10 text-white/40">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-white/40 text-xs truncate">{player.email}</p>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 text-center flex-shrink-0">
              <div>
                <p className="text-white font-bold text-sm">{player.totalPoints}</p>
                <p className="text-white/30 text-xs">pts</p>
              </div>
              <div>
                <p className="text-white font-bold text-sm">{player.weeklyWins}</p>
                <p className="text-white/30 text-xs">wins</p>
              </div>
            </div>

            {/* Pick status */}
            {player.currentWeekId && (
              <div className="flex-shrink-0">
                {player.hasPicked ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" /> Picked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                    <Clock className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
              </div>
            )}

            {/* Toggle active — don't allow deactivating admins */}
            {player.role !== 'ADMIN' && (
              <button
                onClick={() => handleToggle(player.id, !player.isActive)}
                className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                  player.isActive
                    ? 'text-white/30 hover:text-red-400 hover:bg-red-400/10'
                    : 'text-white/30 hover:text-green-400 hover:bg-green-400/10'
                }`}
                title={player.isActive ? 'Deactivate player' : 'Reactivate player'}
              >
                {player.isActive
                  ? <XCircle className="w-4 h-4" />
                  : <CheckCircle className="w-4 h-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}