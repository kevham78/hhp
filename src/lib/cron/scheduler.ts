import cron from 'node-cron'
import { prisma } from '@/lib/db/prisma'
import { runAutoPick } from './autopick'
import { sendEmail } from '@/lib/email/client'
import {
  picksReminderEmail,
  picksRevealEmail,
  commissionerNudgeEmail,
} from '@/lib/email/templates'

// ─────────────────────────────────────────────
// Convert day name + time to cron expression
// e.g. "Thursday", "15:00" → "0 15 * * 4"
// ─────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
}

function toCron(day: string, time: string): string {
  const dayNum          = DAY_MAP[day] ?? 5
  const [hours, minutes] = time.split(':').map(Number)
  // Convert EST to UTC (EST = UTC-5, EDT = UTC-4)
  // We use UTC-5 as a conservative offset
  const utcHours = (hours + 5) % 24
  return `${minutes} ${utcHours} * * ${dayNum}`
}

// ─────────────────────────────────────────────
// Get current active week
// ─────────────────────────────────────────────

async function getActiveWeek() {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
  })
  if (!season) return null

  return prisma.week.findFirst({
    where:   { seasonId: season.id, status: 'OPEN' },
    orderBy: { weekNumber: 'desc' },
  })
}

// ─────────────────────────────────────────────
// Send reminder to players who haven't picked
// ─────────────────────────────────────────────

async function sendReminders(isSecondReminder: boolean) {
  const week = await getActiveWeek()
  if (!week) {
    console.log('[Cron] No active week — skipping reminders')
    return
  }

  const allPlayers = await prisma.user.findMany({
    where: { isActive: true },
  })

  const submitted = await prisma.pick.findMany({
    where:    { weekId: week.id, isDraft: false },
    distinct: ['userId'],
    select:   { userId: true },
  })

  const submittedIds = new Set(submitted.map(p => p.userId))
  const pending      = allPlayers.filter(p => !submittedIds.has(p.id))

  console.log(`[Cron] Sending ${isSecondReminder ? 'second' : 'first'} reminder to ${pending.length} players`)

  const deadline = new Date(week.picksDeadline).toLocaleString('en-CA', {
    weekday:      'long',
    month:        'short',
    day:          'numeric',
    hour:         'numeric',
    minute:       '2-digit',
    timeZone:     'America/Toronto',
    timeZoneName: 'short',
  })

  for (const player of pending) {
    if (!player.email || !player.notifyByEmail) continue
    try {
      await sendEmail({
        to:      player.email,
        subject: isSecondReminder
          ? '⚠️ Last chance! HHP picks due today'
          : '📋 HHP reminder — picks due Friday',
        html: picksReminderEmail({
          playerName:       player.name ?? 'Player',
          isSecondReminder,
          deadline,
        }),
      })
    } catch (err) {
      console.error(`[Cron] Failed to send reminder to ${player.email}:`, err)
    }
  }
}

// ─────────────────────────────────────────────
// Friday 2pm — auto-pick + reveal
// ─────────────────────────────────────────────

async function runDeadlineJob() {
  console.log('[Cron] Running Friday deadline job')

  const week = await getActiveWeek()
  if (!week) {
    console.log('[Cron] No active week — skipping deadline job')
    return
  }

  // Run auto-picks for anyone who hasn't submitted
  await runAutoPick(week.id)

  // Send picks reveal email to all players
  const players = await prisma.user.findMany({
    where: { isActive: true, notifyByEmail: true },
    select: { email: true, name: true },
  })

  for (const player of players) {
    if (!player.email) continue
    try {
      await sendEmail({
        to:      player.email,
        subject: `🏒 HHP Week ${week.weekNumber} picks are in!`,
        html:    picksRevealEmail({
          weekNumber: week.weekNumber,
          weekId:     week.id,
        }),
      })
    } catch (err) {
      console.error(`[Cron] Failed to send reveal email to ${player.email}:`, err)
    }
  }

  console.log('[Cron] Deadline job complete')
}

// ─────────────────────────────────────────────
// Sunday nudge to commissioner
// ─────────────────────────────────────────────

async function runCommissionerNudge() {
  console.log('[Cron] Running commissioner nudge')

  const week = await getActiveWeek()
  if (!week) {
    console.log('[Cron] No active week — skipping nudge')
    return
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { email: true, name: true },
  })

  for (const admin of admins) {
    if (!admin.email) continue
    try {
      await sendEmail({
        to:      admin.email,
        subject: `📋 HHP — Week ${week.weekNumber} results ready to review`,
        html:    commissionerNudgeEmail({
          commissionerName: admin.name ?? 'Commissioner',
          weekNumber:       week.weekNumber,
          weekId:           week.id,
        }),
      })
    } catch (err) {
      console.error(`[Cron] Failed to send nudge to ${admin.email}:`, err)
    }
  }

  console.log('[Cron] Commissioner nudge sent')
}

// ─────────────────────────────────────────────
// Main scheduler — reads settings and starts jobs
// ─────────────────────────────────────────────

let scheduledJobs: cron.ScheduledTask[] = []

export async function startScheduler() {
  console.log('[Cron] Starting scheduler...')

  // Stop any existing jobs
  scheduledJobs.forEach(job => job.stop())
  scheduledJobs = []

  // Load settings
  const settings = await prisma.settings.findFirst({
    where: { id: 'default' },
  })

  if (!settings) {
    console.error('[Cron] No settings found — scheduler not started')
    return
  }

  // Thursday reminder
  const thursdayCron = toCron(settings.reminderOneDay, settings.reminderOneTime)
  scheduledJobs.push(
    cron.schedule(thursdayCron, () => sendReminders(false), {
      timezone: 'America/Toronto',
    })
  )
  console.log(`[Cron] Thursday reminder scheduled: ${thursdayCron}`)

  // Friday morning reminder
  const fridayMorningCron = toCron(settings.reminderTwoDay, settings.reminderTwoTime)
  scheduledJobs.push(
    cron.schedule(fridayMorningCron, () => sendReminders(true), {
      timezone: 'America/Toronto',
    })
  )
  console.log(`[Cron] Friday morning reminder scheduled: ${fridayMorningCron}`)

  // Friday 2pm — auto-pick + reveal
  const deadlineCron = toCron(settings.picksRevealDay, settings.picksRevealTime)
  scheduledJobs.push(
    cron.schedule(deadlineCron, () => runDeadlineJob(), {
      timezone: 'America/Toronto',
    })
  )
  console.log(`[Cron] Friday deadline job scheduled: ${deadlineCron}`)

  // Sunday nudge to commissioner
  const nudgeCron = toCron(settings.resultsEmailDay, settings.resultsEmailTime)
  scheduledJobs.push(
    cron.schedule(nudgeCron, () => runCommissionerNudge(), {
      timezone: 'America/Toronto',
    })
  )
  console.log(`[Cron] Sunday nudge scheduled: ${nudgeCron}`)

  console.log('[Cron] Scheduler started successfully')
}