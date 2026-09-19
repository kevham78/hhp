'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted] = useState(false)

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white placeholder-white/25
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
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
          <h2 className="text-xl font-bold text-white mb-2 text-center">Forgot Password</h2>

          {submitted ? (
            <>
              <p className="text-white/70 text-sm mb-6 text-center">
                If <span className="text-white">{email}</span> is registered, we've sent a
                password reset link to it. Check your inbox (and spam folder).
              </p>
              <Link
                href="/login"
                className="block w-full text-center py-2.5 rounded-lg border border-hhp-navy-light
                           text-white/70 hover:text-white transition-colors"
              >
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <p className="text-white/50 text-sm mb-6 text-center">
                Enter your email and we'll send you a link to reset your password.
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
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <Link
                href="/login"
                className="block mt-4 text-center text-sm text-white/40 hover:text-white transition-colors"
              >
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
