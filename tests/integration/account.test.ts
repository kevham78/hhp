import { describe, it, expect, beforeEach } from 'vitest'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route'
import { POST as resetPassword } from '@/app/api/auth/reset-password/route'
import { POST as changePassword } from '@/app/api/auth/change-password/route'
import { verifyCredentials } from '@/lib/auth/session'
import { prisma, createSettings, createSeason, createUser, asUser, post, sentEmails } from './db'

const DAY = 24 * 3600_000

async function invite(email: string, opts: { expired?: boolean; used?: boolean } = {}) {
  const admin = await createUser({ role: 'ADMIN' })
  return prisma.inviteToken.create({
    data: {
      email, name: 'New Player', createdBy: admin.id,
      expiresAt: new Date(Date.now() + (opts.expired ? -DAY : 7 * DAY)),
      usedAt:    opts.used ? new Date() : null,
    },
  })
}

const signUp = (token: string, email = 'new@test.invalid') =>
  register(post({ name: 'New Player', email, password: 'longenough', token }))

describe('register (invite only)', () => {
  beforeEach(async () => { await createSettings() })

  it('creates the account, uses up the invite and joins the active season', async () => {
    const season = await createSeason()
    const inv = await invite('New@Test.invalid')

    const res = await signUp(inv.token)
    expect(res.status).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@test.invalid' } })
    expect(await verifyCredentials({ email: 'new@test.invalid', password: 'longenough' })).not.toBeNull()
    expect((await prisma.inviteToken.findUniqueOrThrow({ where: { id: inv.id } })).usedAt).not.toBeNull()
    expect(await prisma.seasonStat.count({ where: { userId: user.id, seasonId: season.id } })).toBe(1)
    expect(await prisma.suicideStatus.count({ where: { userId: user.id, seasonId: season.id } })).toBe(1)
  })

  it('rejects bad, used, expired or mismatched invites', async () => {
    expect((await signUp('no-such-token')).status).toBe(400)
    expect((await signUp((await invite('a@test.invalid', { used: true })).token, 'a@test.invalid')).status).toBe(400)
    expect((await signUp((await invite('b@test.invalid', { expired: true })).token, 'b@test.invalid')).status).toBe(400)
    expect((await signUp((await invite('c@test.invalid')).token, 'someone-else@test.invalid')).status).toBe(400)
    expect(await prisma.user.count({ where: { role: 'PLAYER' } })).toBe(0)
  })

  it('treats an existing account with different capitalisation as already registered', async () => {
    await createUser({ email: 'new@test.invalid' })
    const res = await signUp((await invite('NEW@test.invalid')).token, 'NEW@test.invalid')
    expect(res.status).toBe(400)
  })

  it('rejects a short password', async () => {
    const inv = await invite('new@test.invalid')
    const res = await register(post({ name: 'X', email: 'new@test.invalid', password: 'short', token: inv.token }))
    expect(res.status).toBe(400)
  })
})

describe('forgot / reset password', () => {
  it('gives the same answer whether or not the email exists', async () => {
    await createUser({ email: 'real@test.invalid' })
    const a = await (await forgotPassword(post({ email: 'real@test.invalid' }))).json()
    const b = await (await forgotPassword(post({ email: 'nobody@test.invalid' }))).json()
    expect(a).toEqual(b)
    expect(await prisma.verificationToken.count()).toBe(1)
  })

  it('resets with a valid link, and the link only works once', async () => {
    await createUser({ email: 'real@test.invalid', mustChangePassword: true })
    await forgotPassword(post({ email: 'real@test.invalid' }))
    const { token } = await prisma.verificationToken.findFirstOrThrow()

    const reset = () => resetPassword(post({ email: 'real@test.invalid', token, newPassword: 'brand-new-pass' }))
    expect((await reset()).status).toBe(200)
    expect(await verifyCredentials({ email: 'real@test.invalid', password: 'brand-new-pass' }))
      .toMatchObject({ mustChangePassword: false })
    expect((await reset()).status).toBe(400)
  })

  it('works whatever capitalisation the player types', async () => {
    await createUser({ email: 'Real@Test.invalid' })
    await forgotPassword(post({ email: 'REAL@test.INVALID' }))
    const { token, identifier } = await prisma.verificationToken.findFirstOrThrow()
    expect(identifier).toBe('Real@Test.invalid')
    const res = await resetPassword(post({ email: 'real@test.invalid', token, newPassword: 'brand-new-pass' }))
    expect(res.status).toBe(200)
    expect(sentEmails()).toHaveLength(0)   // Resend not configured in tests: link is logged instead
  })

  it('rejects expired or wrong links', async () => {
    await createUser({ email: 'real@test.invalid' })
    await prisma.verificationToken.create({
      data: { identifier: 'real@test.invalid', token: 'old', expires: new Date(Date.now() - 1000) } })
    expect((await resetPassword(post({ email: 'real@test.invalid', token: 'old', newPassword: 'brand-new-pass' }))).status).toBe(400)
    expect((await resetPassword(post({ email: 'real@test.invalid', token: 'guess', newPassword: 'brand-new-pass' }))).status).toBe(400)
  })
})

describe('change password', () => {
  it('requires login and an 8+ character password, then clears the forced change', async () => {
    const u = await createUser({ email: 'p@test.invalid', mustChangePassword: true })
    expect((await changePassword(post({ newPassword: 'whatever123' }))).status).toBe(401)

    asUser(u)
    expect((await changePassword(post({ newPassword: 'short' }))).status).toBe(400)
    expect((await changePassword(post({ newPassword: 'whatever123' }))).status).toBe(200)
    expect(await verifyCredentials({ email: 'p@test.invalid', password: 'whatever123' }))
      .toMatchObject({ mustChangePassword: false })
  })
})
