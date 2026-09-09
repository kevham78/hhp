'use client'

import { useState } from 'react'
import { User, Bell, Lock, Eye, EyeOff } from 'lucide-react'

interface ProfileClientProps {
  name:          string
  email:         string
  notifyByEmail: boolean
  notifyInApp:   boolean
  hasPassword:   boolean
}

export default function ProfileClient({
  name:          initialName,
  email,
  notifyByEmail: initialEmail,
  notifyInApp:   initialInApp,
  hasPassword,
}: ProfileClientProps) {

  // Profile form
  const [name,          setName]          = useState(initialName)
  const [notifyByEmail, setNotifyByEmail] = useState(initialEmail)
  const [notifyInApp,   setNotifyInApp]   = useState(initialInApp)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState('')

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [savingPw,  setSavingPw]  = useState(false)
  const [pwMsg,     setPwMsg]     = useState('')

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white placeholder-white/25
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg('')
    try {
      const res  = await fetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'profile',
          name,
          notifyByEmail,
          notifyInApp,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfileMsg('Profile updated successfully!')
    } catch (err: any) {
      setProfileMsg(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')

    if (newPw !== confirmPw) {
      setPwMsg('New passwords do not match')
      return
    }
    if (newPw.length < 8) {
      setPwMsg('Password must be at least 8 characters')
      return
    }

    setSavingPw(true)
    try {
      const res  = await fetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:          'password',
          currentPassword: currentPw,
          newPassword:     newPw,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPwMsg('Password changed successfully!')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err: any) {
      setPwMsg(err.message || 'Failed to change password')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── PROFILE ──────────────────────────── */}
      <form onSubmit={handleSaveProfile} className="hhp-card space-y-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <User className="w-4 h-4 text-hhp-gold" />
          Profile
        </h2>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className={inputClass + ' opacity-50 cursor-not-allowed'}
          />
          <p className="text-white/30 text-xs mt-1">
            Email cannot be changed
          </p>
        </div>

        {/* Notification preferences */}
        <div>
          <h3 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-white text-sm">Email notifications</p>
                <p className="text-white/30 text-xs">
                  Reminders, results and picks reveal
                </p>
              </div>
              <div
                onClick={() => setNotifyByEmail(!notifyByEmail)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  notifyByEmail ? 'bg-hhp-gold' : 'bg-hhp-navy-light'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white
                                 shadow transition-transform ${
                  notifyByEmail ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-white text-sm">In-app notifications</p>
                <p className="text-white/30 text-xs">
                  Badges and alerts within the app
                </p>
              </div>
              <div
                onClick={() => setNotifyInApp(!notifyInApp)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  notifyInApp ? 'bg-hhp-gold' : 'bg-hhp-navy-light'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white
                                 shadow transition-transform ${
                  notifyInApp ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </div>
            </label>
          </div>
        </div>

        {profileMsg && (
          <p className={`text-sm ${
            profileMsg.includes('success') ? 'text-green-400' : 'text-red-400'
          }`}>
            {profileMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full py-2.5 rounded-lg bg-hhp-gold text-hhp-navy
                     font-bold hover:bg-hhp-gold-light disabled:opacity-50
                     transition-colors"
        >
          {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {/* ── CHANGE PASSWORD ──────────────────── */}
      {hasPassword && (
        <form onSubmit={handleChangePassword} className="hhp-card space-y-4">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-hhp-gold" />
            Change Password
          </h2>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                required
                placeholder="••••••••"
                className={inputClass + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-white/30 hover:text-white/60"
              >
                {showPw
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye    className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              New Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              required
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              required
              placeholder="Repeat new password"
              className={inputClass}
            />
          </div>

          {pwMsg && (
            <p className={`text-sm ${
              pwMsg.includes('success') ? 'text-green-400' : 'text-red-400'
            }`}>
              {pwMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={savingPw}
            className="w-full py-2.5 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                       text-white font-bold disabled:opacity-50 transition-colors"
          >
            {savingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      )}

      {!hasPassword && (
        <div className="hhp-card">
          <p className="text-white/40 text-sm text-center">
            You signed in with Google — password management is handled by Google.
          </p>
        </div>
      )}

    </div>
  )
}