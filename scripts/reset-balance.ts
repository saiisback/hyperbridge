/**
 * Reset all balances for a user by email.
 * Sets totalBalance, availableBalance, roiBalance, and totalInvested to 0.
 *
 * Usage: npx tsx scripts/reset-balance.ts <email>
 * Example: npx tsx scripts/reset-balance.ts karthiksaiketha@gmail.com
 */

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx tsx scripts/reset-balance.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  })

  if (!user) {
    console.error(`User not found with email: ${email}`)
    process.exit(1)
  }

  if (!user.profile) {
    console.error(`No profile found for user: ${email}`)
    process.exit(1)
  }

  console.log(`Found user: ${user.name || user.email} (${user.id})`)
  console.log(`Current balances:`)
  console.log(`  totalBalance:     ₹${user.profile.totalBalance}`)
  console.log(`  availableBalance: ₹${user.profile.availableBalance}`)
  console.log(`  roiBalance:       ₹${user.profile.roiBalance}`)
  console.log(`  totalInvested:    ₹${user.profile.totalInvested}`)

  const updatedProfile = await prisma.profile.update({
    where: { userId: user.id },
    data: {
      totalBalance: 0,
      availableBalance: 0,
      roiBalance: 0,
      totalInvested: 0,
    },
  })

  console.log(`\nSuccessfully reset all balances for ${email}`)
  console.log(`Updated balances:`)
  console.log(`  totalBalance:     ₹${updatedProfile.totalBalance}`)
  console.log(`  availableBalance: ₹${updatedProfile.availableBalance}`)
  console.log(`  roiBalance:       ₹${updatedProfile.roiBalance}`)
  console.log(`  totalInvested:    ₹${updatedProfile.totalInvested}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
