'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', {
      email, password, redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password.')
    } else {
      router.push('/picks')
      router.refresh()
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
          <h2 className="text-xl font-bold text-white mb-6 text-center">Sign In</h2>
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
                className="w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                           px-4 py-2.5 text-white placeholder-white/25
                           focus:outline-none focus:border-hhp-gold/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                           px-4 py-2.5 text-white placeholder-white/25
                           focus:outline-none focus:border-hhp-gold/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-bold text-white
                         bg-hhp-red hover:bg-hhp-red-dark disabled:opacity-50
                         transition-colors duration-150"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}