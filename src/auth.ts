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

      // Revalidate on every request rather than trusting a session
      // cookie indefinitely — if the underlying user was deleted or
      // deactivated since login, invalidate the stale session instead
      // of silently serving empty/wrong data for a dangling user id.
      // This also keeps role/mustChangePassword in sync without
      // requiring the player to log out and back in.
      const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } })
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
