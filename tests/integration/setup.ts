import { inject, vi, beforeEach, afterAll } from 'vitest'

// Point the app's Prisma client at the test database before anything imports it
process.env.DATABASE_URL = inject('databaseUrl')
process.env.NEXT_PUBLIC_APP_URL = 'http://test.local'
delete process.env.RESEND_API_KEY

// ── Session: tests choose who's logged in with asUser() ──
vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (globalThis as any).__testSession ?? null),
}))

// ── Email: record instead of sending ──
vi.mock('@/lib/email/client', () => ({
  FROM_EMAIL: 'test@example.invalid',
  FROM_NAME:  'HHP Test',
  sendEmail:  vi.fn(async (msg: { to: string | string[]; subject: string }) => {
    ;(globalThis as any).__sentEmails.push(msg)
    return { success: true, simulated: true }
  }),
}))

// ── NHL API: served from tests via nhl.setSchedule(), never the network ──
;(globalThis as any).__nhlSchedule = {}
vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
  const url = String(input)
  const m = url.match(/api-web\.nhle\.com\/v1\/schedule\/(\d{4}-\d{2}-\d{2})/)
  if (m) {
    const games = (globalThis as any).__nhlSchedule[m[1]] ?? []
    return new Response(JSON.stringify({ gameWeek: [{ date: m[1], games }] }))
  }
  throw new Error(`Unexpected network call in test: ${url}`)
}))

beforeEach(async () => {
  ;(globalThis as any).__testSession = null
  ;(globalThis as any).__sentEmails  = []
  ;(globalThis as any).__nhlSchedule = {}
  const { resetDb } = await import('./db')
  await resetDb()
})

afterAll(async () => {
  const { prisma } = await import('@/lib/db/prisma')
  await prisma.$disconnect()
})
