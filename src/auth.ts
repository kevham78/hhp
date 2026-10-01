import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db/prisma'
import { verifyCredentials, refreshSessionToken } from '@/lib/auth/session'
import type { UserRole } from '@/types'

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
      authorize: credentials => verifyCredentials(credentials),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      return refreshSessionToken(token, user as Record<string, unknown> | undefined) as any
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
