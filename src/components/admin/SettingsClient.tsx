'use client'

import { useState } from 'react'
import { DollarSign, Clock, AlertTriangle } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface Settings {
  weeklyDues:         number
  weeklyPrize:        number
  monthlyPrize:       number
  suicideWinnerPrize: number
  suicideLoserPrize:  number

  reminderOneDay:     string
  reminderOneTime:    string
  reminderTwoDay:     string
  reminderTwoTime:    string
  picksRevealDay:     string
  picksRevealTime:    string
}

interface Season {
  id:       string
  name:     string
  isActive: boolean
}

interface SettingsClientProps {
  settings: Settings
  seasons:  Season[]
  playerCount: number
}

export default function SettingsClient({ settings, seasons, playerCount }: SettingsClientProps) {
  const [form,    setForm]    = useState<Settings>(settings)
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Season management
  const [showStartConfirm, setShowStartConfirm] = useState(false)
  const [selectedSeason,   setSelectedSeason]   = useState(
    seasons.find(s => s.isActive)?.id ?? seasons[0]?.id ?? ''
  )
  const [starting,  setStarting]  = useState(false)
  const [seasonMsg, setSeasonMsg] = useState('')

  const activeSeason = seasons.find(s => s.isActive)

  function updateForm(key: keyof Settings, value: number | string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Calculate total to help commissioner verify splits
  const totalCollected = form.weeklyDues * playerCount
const splitTotal     = form.weeklyPrize + form.monthlyPrize +
                       form.suicideWinnerPrize + form.suicideLoserPrize
const splitMatch     = Math.abs(splitTotal - totalCollected) < 0.01

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res  = await fetch('/api/admin/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ text: 'Settings saved successfully!', type: 'success' })
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save settings', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleStartSeason() {
    setStarting(true)
    setSeasonMsg('')
    try {
      const res  = await fetch('/api/admin/season', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'start', seasonId: selectedSeason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSeasonMsg('Season started successfully! All stats have been reset.')
      setShowStartConfirm(false)
      window.location.reload()
    } catch (err: any) {
      setSeasonMsg(err.message || 'Failed to start season')
    } finally {
      setStarting(false)
    }
  }

  const inputClass = `w-full bg-hhp-navy border border-hhp-navy-light rounded-lg
                      px-4 py-2.5 text-white
                      focus:outline-none focus:border-hhp-gold/50 transition-colors`

  const selectClass = `bg-hhp-navy border border-hhp-navy-light rounded-lg
                       px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-hhp-gold/50 transition-colors`

  return (
    <div className="space-y-6">

      {/* ── SEASON MANAGEMENT ──────────────── */}
      <div className="hhp-card hhp-gold-border space-y-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          🏒 Season Management
        </h2>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-hhp-navy border border-hhp-navy-light">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            activeSeason ? 'bg-green-400 animate-pulse' : 'bg-white/20'
          }`} />
          <div>
            <p className="text-white text-sm font-semibold">
              {activeSeason ? `${activeSeason.name} Season — Active` : 'No active season'}
            </p>
            <p className="text-white/40 text-xs">
              {activeSeason
                ? 'Season is running. Players can make picks.'
                : 'Start a season to allow players to make picks.'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Select Season to Start
            </label>
            <select
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
              className={selectClass + ' w-full'}
            >
              {seasons.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {!showStartConfirm ? (
            <button
              onClick={() => setShowStartConfirm(true)}
              className="w-full py-2.5 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                         text-white font-bold transition-colors"
            >
              🚀 Start Season
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-hhp-red/10 border border-hhp-red/30 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-hhp-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-bold text-sm">Are you sure?</p>
                  <p className="text-white/60 text-xs mt-1">
                    This will activate the <strong>{seasons.find(s => s.id === selectedSeason)?.name}</strong> season
                    and reset all player stats, points, and suicide pool status.
                    This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleStartSeason}
                  disabled={starting}
                  className="flex-1 py-2 rounded-lg bg-hhp-red hover:bg-hhp-red-dark
                             text-white font-bold text-sm disabled:opacity-50 transition-colors"
                >
                  {starting ? 'Starting...' : 'Yes, Start Season'}
                </button>
                <button
                  onClick={() => setShowStartConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-hhp-navy-light
                             text-white/60 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {seasonMsg && (
            <p className={`text-sm ${
              seasonMsg.includes('success') ? 'text-green-400' : 'text-red-400'
            }`}>
              {seasonMsg}
            </p>
          )}
        </div>
      </div>

      {/* ── FINANCIAL SETTINGS ─────────────── */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="hhp-card space-y-4">
          <h2 className="text-white font-bold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-hhp-gold" />
            Financial Settings
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Weekly Dues ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="1"
                value={form.weeklyDues}
                onChange={e => updateForm('weeklyDues', parseFloat(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Weekly Prize ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={form.weeklyPrize}
                onChange={e => updateForm('weeklyPrize', parseFloat(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Monthly Pot ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={form.monthlyPrize}
                onChange={e => updateForm('monthlyPrize', parseFloat(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Suicide Winner Pool ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={form.suicideWinnerPrize}
                onChange={e => updateForm('suicideWinnerPrize', parseFloat(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Suicide Loser Pool ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                value={form.suicideLoserPrize}
                onChange={e => updateForm('suicideLoserPrize', parseFloat(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Split summary */}
<div className={`p-3 rounded-lg border text-sm ${
  splitMatch
    ? 'border-green-500/30 bg-green-500/5 text-green-400'
    : 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
}`}>
  <p className="font-semibold">
    Weekly collected: ${totalCollected.toFixed(2)}
    ({playerCount} players × ${form.weeklyDues.toFixed(2)})
  </p>
  <p className="mt-1">
    Prize split total: ${splitTotal.toFixed(2)}
  </p>
  {!splitMatch && (
    <p className="text-xs mt-1 opacity-75">
      ⚠️ Prize splits (${splitTotal.toFixed(2)}) don't equal
      weekly collected (${totalCollected.toFixed(2)}).
      Adjust prizes to match your player count.
    </p>
  )}
  {splitMatch && (
    <p className="text-xs mt-1 opacity-75">✅ Splits balance perfectly!</p>
  )}
</div>
</div>

        {/* ── EMAIL SCHEDULE ──────────────── */}
        <div className="hhp-card space-y-4">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-hhp-gold" />
            Email Schedule (EST)
          </h2>

          {[
            {
              label:   'First Reminder',
              dayKey:  'reminderOneDay'  as keyof Settings,
              timeKey: 'reminderOneTime' as keyof Settings,
              hint:    'First picks reminder',
            },
            {
              label:   'Second Reminder',
              dayKey:  'reminderTwoDay'  as keyof Settings,
              timeKey: 'reminderTwoTime' as keyof Settings,
              hint:    'Second picks reminder',
            },
            {
              label:   'Picks Reveal',
              dayKey:  'picksRevealDay'  as keyof Settings,
              timeKey: 'picksRevealTime' as keyof Settings,
              hint:    'Auto-pick deadline + reveal all picks',
            },
          ].map(({ label, dayKey, timeKey, hint }) => (
            <div key={dayKey}>
              <label className="block text-sm font-medium text-white/70 mb-1">
                {label}
              </label>
              <p className="text-white/30 text-xs mb-2">{hint}</p>
              <div className="flex gap-2">
                <select
                  value={form[dayKey] as string}
                  onChange={e => updateForm(dayKey, e.target.value)}
                  className={selectClass + ' flex-1'}
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={form[timeKey] as string}
                  onChange={e => updateForm(timeKey, e.target.value)}
                  className={selectClass + ' w-32'}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save */}
        {message && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-lg bg-hhp-gold hover:bg-hhp-gold-light
                     text-hhp-navy font-bold disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}