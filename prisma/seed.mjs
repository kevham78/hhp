import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

// Simple hash without bcrypt for now
function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex')
}

async function main() {
  console.log('🌱 Seeding HHP database...')

  const wayne = await prisma.user.upsert({
    where:  { email: 'waynehicks2000@yahoo.com' },
    update: {},
    create: {
      email:    'waynehicks2000@yahoo.com',
      name:     'Wayne',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i',
      role:     'ADMIN',
      isActive: true,
      notifyByEmail: true,
      notifyInApp:   true,
    },
  })
  console.log(`✅ Created: ${wayne.name} (${wayne.email})`)

  const kevin = await prisma.user.upsert({
    where:  { email: 'kevyham@gmail.com' },
    update: {},
    create: {
      email:    'kevyham@gmail.com',
      name:     'Kevin',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i',
      role:     'ADMIN',
      isActive: true,
      notifyByEmail: true,
      notifyInApp:   true,
    },
  })
  console.log(`✅ Created: ${kevin.name} (${kevin.email})`)

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
    where:  { id: 'season-2025-26' },
    update: {},
    create: {
      id:        'season-2025-26',
      name:      '2025-26',
      startDate: new Date('2025-10-07T00:00:00.000Z'),
      endDate:   new Date('2026-04-18T23:59:59.000Z'),
      isActive:  false,
    },
  })
  console.log(`✅ Season created: ${season.name}`)

  for (const user of [wayne, kevin]) {
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
  console.log('   Temp password for both admins: ChangeMe123!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())