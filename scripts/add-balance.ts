/**
 * Add account balance for a user by email (mirrors normal deposit flow).
 * Principal is locked for 4 months, same as a regular deposit.
 *
 * Usage: npx tsx scripts/add-balance.ts <email> <amount>
 * Example: npx tsx scripts/add-balance.ts klfc.sudhakar@gmail.com 50000
 */

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2]
  const amount = parseFloat(process.argv[3])

  if (!email || isNaN(amount) || amount <= 0) {
    console.error('Usage: npx tsx scripts/add-balance.ts <email> <amount>')
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
  console.log(`  totalInvested:    ₹${user.profile.totalInvested}`)

  const result = await prisma.$transaction(async (tx) => {
    // Ensure user looks like a normal verified user
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: 'user',
        isActive: true,
        kycVerified: true,
        onboardingCompleted: true,
      },
    })

    // Create a deposit transaction record
    const transaction = await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount,
        amountInr: amount,
        status: 'completed',
        metadata: {
          note: 'Manual balance addition by admin',
          addedAt: new Date().toISOString(),
        },
      },
    })

    // Update profile balances
    const updatedProfile = await tx.profile.update({
      where: { userId: user.id },
      data: {
        totalBalance: { increment: amount },
        availableBalance: { increment: amount },
        totalInvested: { increment: amount },
      },
    })

    return { transaction, profile: updatedProfile }
  })

  console.log(`\nSuccessfully added ₹${amount} to ${email}`)
  console.log(`Transaction ID: ${result.transaction.id}`)
  console.log(`Updated balances:`)
  console.log(`  totalBalance:     ₹${result.profile.totalBalance}`)
  console.log(`  availableBalance: ₹${result.profile.availableBalance}`)
  console.log(`  totalInvested:    ₹${result.profile.totalInvested}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
