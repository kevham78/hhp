import { prisma } from '@/lib/db/prisma'

// Emails are matched case-insensitively everywhere (login, invites,
// password reset) — "Wayne@Example.com" and "wayne@example.com" are
// the same player. Stored addresses keep whatever case they were saved with.
export function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  })
}
