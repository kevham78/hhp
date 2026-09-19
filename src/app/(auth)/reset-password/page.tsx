'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [token,     setToken]     = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [missingLink, setMissingLink] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    const e = params.get('email')
    if (!t || !e) {
      setMissingLink(true)
      return
    }
    setToken(t)
    setEmail(e)
  }, [])

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white placeholder-white/25
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPw) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, token, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/login?passwordChanged=1')
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (missingLink) {
    return (
      <div className="min-h-screen bg-hhp-navy flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-black text-white tracking-wider mb-2">HHP</h1>
          <div className="hhp-card hhp-gold-border">
            <p className="text-white font-bold mb-2">Invalid reset link</p>
            <p className="text-white/50 text-sm">
              This link is missing its reset token. Request a new one from the
              forgot password page.
            </p>
          </div>
        </div>
      </div>
    )
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
            for <span className="text-white">{email}</span>
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
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              {loading ? 'Saving...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
