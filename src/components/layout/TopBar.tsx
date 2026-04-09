'use client'

import { signOut } from 'next-auth/react'
import { Bell, ChevronDown, LogOut, User, Shield } from 'lucide-react'
import { useState } from 'react'

interface TopBarProps {
  user: { id: string; name: string; email: string; image: string; role: string }
}

export default function TopBar({ user }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="h-14 bg-hhp-navy-mid border-b border-hhp-navy-light flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-7 h-7 rounded-full bg-hhp-navy-light border border-hhp-gold/30 flex items-center justify-center">
              <span className="text-hhp-gold text-xs font-bold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-white text-sm font-medium hidden sm:block">{user.name}</span>
            {user.role === 'ADMIN' && <Shield className="w-3 h-3 text-hhp-gold hidden sm:block" />}
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-hhp-navy-mid border border-hhp-navy-light rounded-xl shadow-2xl z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-hhp-navy-light">
                  <p className="text-white text-sm font-semibold">{user.name}</p>
                  <p className="text-white/40 text-xs truncate">{user.email}</p>
                  {user.role === 'ADMIN' && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs bg-hhp-gold/15 text-hhp-gold">
                      <Shield className="w-2.5 h-2.5" /> Commissioner
                    </span>
                  )}
                </div>
                <div className="p-1">
                  <button onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-hhp-red hover:bg-hhp-red/10 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}