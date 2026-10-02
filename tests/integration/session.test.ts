import { describe, it, expect } from 'vitest'
import { verifyCredentials, refreshSessionToken } from '@/lib/auth/session'
import { prisma, createUser, PASSWORD } from './db'

describe('verifyCredentials (login)', () => {
  it('accepts the right password', async () => {
    const u = await createUser({ email: 'wayne@test.invalid', role: 'ADMIN' })
    expect(await verifyCredentials({ email: 'wayne@test.invalid', password: PASSWORD }))
      .toMatchObject({ id: u.id, role: 'ADMIN', mustChangePassword: false })
  })

  it('ignores the case of the email address', async () => {
    const u = await createUser({ email: 'Wayne.Hicks@Test.invalid' })
    expect(await verifyCredentials({ email: 'wayne.hicks@test.invalid', password: PASSWORD })).toMatchObject({ id: u.id })
    expect(await verifyCredentials({ email: 'WAYNE.HICKS@TEST.INVALID', password: PASSWORD })).toMatchObject({ id: u.id })
  })

  it('rejects a wrong password, unknown email, inactive player or junk input', async () => {
    await createUser({ email: 'a@test.invalid' })
    await createUser({ email: 'gone@test.invalid', isActive: false })
    expect(await verifyCredentials({ email: 'a@test.invalid', password: 'wrong-password' })).toBeNull()
    expect(await verifyCredentials({ email: 'nobody@test.invalid', password: PASSWORD })).toBeNull()
    expect(await verifyCredentials({ email: 'gone@test.invalid', password: PASSWORD })).toBeNull()
    expect(await verifyCredentials({ email: 'not-an-email', password: PASSWORD })).toBeNull()
    expect(await verifyCredentials(undefined)).toBeNull()
  })
})

describe('refreshSessionToken (checked on every request)', () => {
  it('copies the user into the token at login', async () => {
    const token = await refreshSessionToken({}, { id: 'u1', role: 'PLAYER', mustChangePassword: true })
    expect(token).toMatchObject({ id: 'u1', role: 'PLAYER', mustChangePassword: true })
  })

  it('keeps a valid session and picks up role / password-change changes', async () => {
    const u = await createUser({ role: 'PLAYER' })
    await prisma.user.update({ where: { id: u.id }, data: { role: 'ADMIN', mustChangePassword: true } })
    expect(await refreshSessionToken({ id: u.id, role: 'PLAYER', mustChangePassword: false }))
      .toMatchObject({ id: u.id, role: 'ADMIN', mustChangePassword: true })
  })

  it('ends the session if the account was re-created with a new id (Wayne\'s bug)', async () => {
    const u = await createUser()
    const token = { id: u.id, role: 'PLAYER' }
    await prisma.user.update({ where: { id: u.id }, data: { id: 'recreated-id' } })
    expect(await refreshSessionToken(token)).toBeNull()
  })

  it('ends the session for a deactivated player', async () => {
    const u = await createUser()
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } })
    expect(await refreshSessionToken({ id: u.id })).toBeNull()
  })
})
