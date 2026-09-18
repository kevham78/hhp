'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  const [token,     setToken]     = useState('')
  const [email,     setEmail]     = useState('')
  const [name,      setName]      = useState('')
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
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password, token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/login?registered=1')
    } catch (err: any) {
      setError(err.message || 'Failed to create account.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white placeholder-white/25
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  if (missingLink) {
    return (
      <div className="min-h-screen bg-hhp-navy flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-black text-white tracking-wider mb-2">HHP</h1>
          <div className="hhp-card hhp-gold-border">
            <p className="text-white font-bold mb-2">Invalid invite link</p>
            <p className="text-white/50 text-sm">
              This link is missing its invite token. Ask your commissioner to
              resend your invite.
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
          <h2 className="text-xl font-bold text-white mb-2 text-center">Create Your Account</h2>
          <p className="text-white/50 text-sm mb-6 text-center">
            You've been invited to join the pool.
          </p>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} opacity-50 cursor-not-allowed`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="First name is fine"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
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
                placeholder="Repeat password"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
