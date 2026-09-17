import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLAYERS = [
  { name: 'Wayne',    email: 'waynehicks2000@yahoo.com', role: 'ADMIN'  },
  { name: 'Kevin',    email: 'kevyham@gmail.com',         role: 'ADMIN'  },
  { name: 'Andrew',   email: 'korn75@gmail.com',          role: 'PLAYER' },
  { name: 'Clifford', email: 'cliff.hicks@outlook.com',   role: 'PLAYER' },
  { name: 'Jon',      email: 'jon.hicks12@gmail.com',     role: 'PLAYER' },
  { name: 'Mike',     email: 'mikehall_77@hotmail.com',   role: 'PLAYER' },
  { name: 'Perry',    email: 'pjcornforth@outlook.com',   role: 'PLAYER' },
  { name: 'Phillip',  email: 'phimp@videotron.ca',        role: 'PLAYER' },
  { name: 'Tyler',    email: 'ty.hicks77@yahoo.com',      role: 'PLAYER' },
]

async function main() {
  console.log('🌱 Seeding HHP database...')

  const tempPassword = await bcrypt.hash('hockey', 12)

  const users = []
  for (const p of PLAYERS) {
    const user = await prisma.user.upsert({
      where:  { email: p.email },
      update: {},
      create: {
        email:              p.email,
        name:               p.name,
        password:           tempPassword,
        mustChangePassword: true,
        role:               p.role,
        isActive:           true,
        notifyByEmail:      true,
        notifyInApp:        true,
      },
    })
    users.push(user)
    console.log(`✅ Created: ${user.name} (${user.email}) [${user.role}]`)
  }

  const wayne = users[0]

  const settings = await prisma.settings.upsert({
    where:  { id: 'default' },
    update: {},
    create: {
      id:                 'default',
      weeklyDues:         5.00,
      weeklyPrize:        30.00,
      monthlyPrize:       5.00,
      suicideWinnerPrize: 5.00,
      suicideLoserPrize:  5.00,
      resultsEmailDay:    'Monday',
      resultsEmailTime:   '09:00',
      reminderOneDay:     'Thursday',
      reminderOneTime:    '15:00',
      reminderTwoDay:     'Friday',
      reminderTwoTime:    '08:00',
      picksRevealDay:     'Friday',
      picksRevealTime:    '14:00',
      updatedBy:          wayne.id,
    },
  })
  console.log('✅ Settings created')

  const season = await prisma.season.upsert({
  where:  { id: 'season-2026-27' },
  update: {},
  create: {
    id:        'season-2026-27',
    name:      '2026-27',
    startDate: new Date('2026-09-29T00:00:00.000Z'),
    endDate:   new Date('2027-04-10T23:59:59.000Z'),
    isActive:  false,
  },
})
  console.log(`✅ Season created: ${season.name}`)

  for (const user of users) {
    await prisma.seasonStat.upsert({
      where:  { userId_seasonId: { userId: user.id, seasonId: season.id } },
      update: {},
      create: { userId: user.id, seasonId: season.id },
    })
    await prisma.suicideStatus.upsert({
      where:  { userId_seasonId: { userId: user.id, seasonId: season.id } },
      update: {},
      create: {
        userId:          user.id,
        seasonId:        season.id,
        winnerTeamsUsed: [],
        loserTeamsUsed:  [],
      },
    })
  }

  await prisma.suicidePoolState.upsert({
    where:  { poolType_seasonId: { poolType: 'WINNER', seasonId: season.id } },
    update: {},
    create: { poolType: 'WINNER', seasonId: season.id, currentPot: 0, isActive: true },
  })

  await prisma.suicidePoolState.upsert({
    where:  { poolType_seasonId: { poolType: 'LOSER', seasonId: season.id } },
    update: {},
    create: { poolType: 'LOSER', seasonId: season.id, currentPot: 0, isActive: true },
  })

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🏒 HHP database seeded successfully!')
  console.log('   Temp password for all players: hockey')
  console.log('   Everyone must set a new password on first login.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
