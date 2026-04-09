import { CheckCircle } from 'lucide-react'

interface PhaseBannerProps {
  phase:    number
  title:    string
  subtitle: string
  complete: boolean
}

export default function PhaseBanner({ phase, title, subtitle, complete }: PhaseBannerProps) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${
      complete
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-hhp-gold/30 bg-hhp-gold/5'
    }`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
        complete ? 'bg-green-500/20 text-green-400' : 'bg-hhp-gold/20 text-hhp-gold'
      }`}>
        {complete ? <CheckCircle className="w-5 h-5" /> : phase}
      </div>
      <div>
        <p className={`font-bold text-sm ${complete ? 'text-green-400' : 'text-hhp-gold'}`}>
          Phase {phase} — {title}
        </p>
        <p className="text-white/40 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}