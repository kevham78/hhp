'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

export default function ChangePasswordPage() {
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white placeholder-white/25
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPw.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/auth/change-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await signOut({ callbackUrl: '/login?passwordChanged=1' })
    } catch (err: any) {
      setError(err.message || 'Failed to set password.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hhp-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-wider">HHP</h1>
          <p className="text-hhp-gold text-sm mt-1">Hicks Hockey Pool</p>
        </div>
        <div className="hhp-card hhp-gold-border">
          <h2 className="text-xl font-bold text-white mb-2 text-center">Set a New Password</h2>
          <p className="text-white/50 text-sm mb-6 text-center">
            You're using a temporary password. Choose a new one to continue.
          </p>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                required
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-bold text-white
                         bg-hhp-red hover:bg-hhp-red-dark disabled:opacity-50
                         transition-colors duration-150"
            >
              {loading ? 'Saving...' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
