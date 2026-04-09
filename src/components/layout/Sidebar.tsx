'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, DollarSign, BarChart3, Settings, Users, ShieldCheck } from 'lucide-react'
import HHPLogo from './HHPLogo'
import clsx from 'clsx'

function PuckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="12" rx="10" ry="5"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
    </svg>
  )
}

const playerNav = [
  { href: '/picks',     label: 'My Picks',  icon: PuckIcon },
  { href: '/results',   label: 'Results',   icon: Trophy },
  { href: '/standings', label: 'Standings', icon: BarChart3 },
  { href: '/payments',  label: 'Money',     icon: DollarSign },
]

const adminNav = [
  { href: '/admin',          label: 'Dashboard', icon: ShieldCheck },
  { href: '/admin/players',  label: 'Players',   icon: Users },
  { href: '/admin/settings', label: 'Settings',  icon: Settings },
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || (href !== '/picks' && pathname.startsWith(href))
    return (
      <Link href={href} className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
        active ? 'bg-hhp-gold/15 text-hhp-gold border border-hhp-gold/20'
               : 'text-white/60 hover:text-white hover:bg-white/5'
      )}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-hhp-gold" />}
      </Link>
    )
  }

  return (
    <aside className="hidden md:flex flex-col w-56 bg-hhp-navy-mid border-r border-hhp-navy-light flex-shrink-0">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-hhp-navy-light">
        <HHPLogo className="w-10 h-10 flex-shrink-0" />
        <div>
          <div className="text-white font-black text-sm tracking-wider">HHP</div>
          <div className="text-hhp-gold/60 text-xs">Hicks Hockey Pool</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-white/25 text-xs font-semibold uppercase tracking-widest px-3 mb-2">Pool</p>
        {playerNav.map(item => <NavLink key={item.href} {...item} />)}
        {role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-white/25 text-xs font-semibold uppercase tracking-widest px-3">Commissioner</p>
            </div>
            {adminNav.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>
      <div className="px-4 py-3 border-t border-hhp-navy-light">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/40 text-xs">Season 2025–26</span>
        </div>
      </div>
    </aside>
  )
}