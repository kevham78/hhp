// Resets one or more accounts back to the shared temp password and
// forces a password change on next login.
//
// seed.mjs's user upsert never touches an existing account's password
// (`update: {}`), so re-seeding won't reset anyone who already has a
// real password set — that's intentional, so re-seeding never clobbers
// a real chosen password once the app is in real use. Use this script
// instead whenever you actually want to force accounts back to the
// temp password (e.g. resetting everyone to a known state before a
// new test run or season).
//
// Usage:
//   node prisma/reset-temp-passwords.mjs                    # reset every user
//   node prisma/reset-temp-passwords.mjs a@x.com b@y.com     # reset just these

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const TEMP_PASSWORD = 'hockey'

const prisma = new PrismaClient()

async function main() {
  const emails = process.argv.slice(2)
  const users  = emails.length > 0
    ? await prisma.user.findMany({ where: { email: { in: emails } } })
    : await prisma.user.findMany()

  if (users.length === 0) {
    console.log('No matching users found.')
    return
  }

  const hash = await bcrypt.hash(TEMP_PASSWORD, 12)

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hash, mustChangePassword: true },
    })
    console.log(`✅ Reset: ${user.name} (${user.email})`)
  }

  console.log('')
  console.log(`Temp password for ${users.length} account(s): ${TEMP_PASSWORD}`)
}

main()
  .catch((e) => { console.error('❌ Reset failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
