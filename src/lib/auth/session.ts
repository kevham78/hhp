import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { findUserByEmail } from '@/lib/db/users'

// Login and session logic used by src/auth.ts, kept here (free of
// NextAuth itself) so it can be tested directly.

const signInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})

// Credentials sign-in: returns the user to put in the session, or null.
export async function verifyCredentials(credentials: unknown) {
  const parsed = signInSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, password } = parsed.data

  const user = await findUserByEmail(email)

  if (!user || !user.password) return null
  if (!user.isActive) return null

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) return null

  return {
    id:                 user.id,
    email:              user.email,
    name:               user.name,
    role:               user.role,
    image:              user.image,
    mustChangePassword: user.mustChangePassword,
  }
}

type Token = Record<string, unknown>

// NextAuth jwt callback. Returning null ends the session.
export async function refreshSessionToken(token: Token, user?: Record<string, unknown>) {
  if (user) {
    token.id                 = user.id
    token.role               = user.role
    token.mustChangePassword = user.mustChangePassword
    return token
  }

  // Re-check the user on every request instead of trusting the
  // cookie for its whole 30-day life. If the account was deleted,
  // deactivated or re-created (new id) since login, end the session
  // so the player is sent to log in again — otherwise every save
  // fails with a foreign-key error against the old user id.
  // (Safe now that proxy.ts runs on the Node runtime, not Edge.)
  const dbUser = token.id
    ? await prisma.user.findUnique({
        where:  { id: token.id as string },
        select: { isActive: true, role: true, mustChangePassword: true },
      })
    : null
  if (!dbUser || !dbUser.isActive) return null

  token.role               = dbUser.role
  token.mustChangePassword = dbUser.mustChangePassword
  return token
}
