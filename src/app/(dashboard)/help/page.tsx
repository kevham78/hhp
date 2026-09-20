import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import {
  HelpCircle, Target, ListOrdered, Skull, Trophy, DollarSign,
  BarChart3, Clock, Mail,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function Section({
  icon: Icon, title, children,
}: {
  icon: any
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="hhp-card">
      <h2 className="text-white font-bold flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-hhp-gold" />
        {title}
      </h2>
      <div className="text-white/70 text-sm space-y-2 leading-relaxed">
        {children}
      </div>
    </div>
  )
}

export default async function HelpPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const settings = await prisma.settings.findFirst({ where: { id: 'default' } })

  const weeklyDues         = settings?.weeklyDues         ?? 5
  const weeklyPrize        = settings?.weeklyPrize        ?? 30
  const monthlyPrize       = settings?.monthlyPrize       ?? 5
  const suicideWinnerPrize = settings?.suicideWinnerPrize ?? 5
  const suicideLoserPrize  = settings?.suicideLoserPrize  ?? 5
  const deadlineDay        = settings?.picksRevealDay     ?? 'Friday'
  const deadlineTime       = formatTime(settings?.picksRevealTime ?? '14:00')
  const reminder1Day       = settings?.reminderOneDay     ?? 'Thursday'
  const reminder1Time      = formatTime(settings?.reminderOneTime ?? '15:00')
  const reminder2Day       = settings?.reminderTwoDay     ?? 'Friday'
  const reminder2Time      = formatTime(settings?.reminderTwoTime ?? '08:00')

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-hhp-gold" />
          How HHP Works
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Everything you need to know to make your picks and follow along.
        </p>
      </div>

      <Section icon={Clock} title="The Weekly Deadline">
        <p>
          Every game happening this <strong className="text-white">Saturday and Sunday</strong>{' '}
          needs a pick from you before <strong className="text-white">{deadlineDay} at {deadlineTime}</strong>.
          After that, picks lock and the week is revealed to everyone.
        </p>
        <p>
          Forgot to pick? Don't worry — any games you haven't picked are filled
          in randomly for you right at the deadline so you're never left out.
          You'll also get email reminders on {reminder1Day} ({reminder1Time}) and
          {' '}{reminder2Day} morning ({reminder2Time}) if you still have picks left.
        </p>
        <p>
          Once locked, <strong className="text-white">My Picks</strong> stays on that
          week — view-only — until the commissioner confirms results (or they're
          auto-approved Monday if the commissioner hasn't gotten to it yet). Only
          then does the page open back up for next week's picks.
        </p>
      </Section>

      <Section icon={Target} title="Phase 1 — Pick Your Winners">
        <p>
          On the <strong className="text-white">My Picks</strong> page, pick the
          winner (home or away) for every game on the board — one point for
          every correct pick. Most points for the week wins the weekly prize.
        </p>
      </Section>

      <Section icon={ListOrdered} title="Phase 2 — Tiebreakers">
        <p>
          Once every game has a pick, choose your <strong className="text-white">
          3 most confident picks</strong> from Phase 1 and rank them 1st, 2nd
          and 3rd. If two or more players tie on points for the week, whoever's
          1st tiebreaker was correct wins; if that's still tied, it goes to the
          2nd, then the 3rd. Still tied after all three? The prize is split.
        </p>
      </Section>

      <Section icon={Skull} title="Phase 3 — Suicide Pools">
        <p>
          There are two separate pools, and both work off your Phase 1 picks:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong className="text-white">Winner Pool</strong> — pick one team you picked to WIN.</li>
          <li><strong className="text-white">Loser Pool</strong> — pick one team you picked to LOSE.</li>
        </ul>
        <p>
          Each pool is <strong className="text-white">double elimination</strong> —
          two wrong picks and you're out of that pool (being out of one doesn't
          affect the other). You can never pick the same team twice in the same
          pool during the season. Last player standing in each pool takes the
          pot; if everyone still in gets eliminated the same week, the pot
          splits between them. Check the <strong className="text-white">Suicide Pool</strong>{' '}
          page any time to see everyone's picks and who's still alive.
        </p>
      </Section>

      <Section icon={DollarSign} title="Money">
        <p>Dues are <strong className="text-white">${weeklyDues.toFixed(2)}/week</strong>, split up as:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>${weeklyPrize.toFixed(2)} to that week's points winner</li>
          <li>${monthlyPrize.toFixed(2)}/week added to the monthly pot</li>
          <li>${suicideWinnerPrize.toFixed(2)}/week added to the Suicide Winner pot</li>
          <li>${suicideLoserPrize.toFixed(2)}/week added to the Suicide Loser pot</li>
        </ul>
        <p>
          Visit the <strong className="text-white">Money</strong> page to see what
          you owe, what you've won, and your full payment history. Talk to the
          commissioner to settle up in person — they'll log it once received.
        </p>
      </Section>

      <Section icon={BarChart3} title="Where to Find Things">
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong className="text-white">Standings</strong> — season-long points and rankings for everyone.</li>
          <li><strong className="text-white">My Picks</strong> — make or update this week's picks before the deadline.</li>
          <li><strong className="text-white">Suicide Pool</strong> — every player's winner/loser picks, week by week.</li>
          <li><strong className="text-white">Results</strong> — the full picks grid once a week is revealed.</li>
          <li><strong className="text-white">Money</strong> — balances, pots, and payment history.</li>
        </ul>
      </Section>

      <Section icon={Mail} title="Still Stuck?">
        <p>
          Reach out to your commissioner — they can check your picks, fix a
          mistake, or answer anything this page didn't cover.
        </p>
      </Section>
    </div>
  )
}
