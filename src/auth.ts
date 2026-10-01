import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import type { UserRole } from '@/types'

const signInSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn:  '/login',
    error:   '/login',
    newUser: '/register',
  },
  providers: [
    Credentials({
      async authorize(credentials) {
  
  const parsed = signInSchema.safeParse(credentials)
  if (!parsed.success) return null

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })

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
},
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id                 = user.id
        token.role               = (user as any).role
        token.mustChangePassword = (user as any).mustChangePassword
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
    },
    async session({ session, token }) {
      if (token) {
        session.user.id                 = token.id as string
        session.user.role               = token.role as UserRole
        session.user.mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    },
  },
})
