/**
 * Data migration script: Backfill roiBalance, add lockedUntil to existing deposits,
 * and recalculate availableBalance for the principal lock feature.
 *
 * Run with: npx tsx scripts/backfill-roi-balance.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LOCK_DURATION_MONTHS = 4

async function main() {
  console.log('Starting backfill migration...\n')

  // 1. Add lockedUntil to existing deposit transactions
  console.log('Step 1: Adding lockedUntil to existing deposits...')
  const deposits = await prisma.transaction.findMany({
    where: { type: 'deposit', status: 'completed' },
  })

  let depositsUpdated = 0
  for (const dep of deposits) {
    const meta = (dep.metadata as Record<string, unknown>) || {}
    if (meta.lockedUntil) continue // Already has lockedUntil

    const lockDate = new Date(dep.createdAt)
    lockDate.setMonth(lockDate.getMonth() + LOCK_DURATION_MONTHS)

    await prisma.transaction.update({
      where: { id: dep.id },
      data: {
        metadata: {
          ...meta,
          lockedUntil: lockDate.toISOString(),
        },
      },
    })
    depositsUpdated++
  }
  console.log(`  Updated ${depositsUpdated} deposits with lockedUntil\n`)

  // 2. Backfill roiBalance for each user
  console.log('Step 2: Backfilling roiBalance for users...')
  const profiles = await prisma.profile.findMany({
    select: { userId: true },
  })

  let profilesUpdated = 0
  for (const profile of profiles) {
    const userId = profile.userId

    // Sum of ROI transactions
    const roiAgg = await prisma.transaction.aggregate({
      where: { userId, type: 'roi', status: 'completed' },
      _sum: { amount: true },
    })
    const totalRoi = Number(roiAgg._sum.amount ?? 0)

    // Sum of referral transactions
    const referralAgg = await prisma.transaction.aggregate({
      where: { userId, type: 'referral', status: 'completed' },
      _sum: { amount: true },
    })
    const totalReferral = Number(referralAgg._sum.amount ?? 0)

    // Sum of completed + pending withdrawals (amountInr)
    const withdrawAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'withdraw',
        status: { in: ['completed', 'pending'] },
      },
      _sum: { amountInr: true },
    })
    const totalWithdrawn = Number(withdrawAgg._sum.amountInr ?? 0)

    // roiBalance = earnings - withdrawals (floored at 0)
    // This assumes past withdrawals came from earnings first
    const roiBalance = Math.max(0, totalRoi + totalReferral - totalWithdrawn)

    await prisma.profile.update({
      where: { userId },
      data: {
        roiBalance,
      },
    })
    profilesUpdated++

    console.log(
      `  User ${userId}: ROI=${totalRoi.toFixed(2)}, Referral=${totalReferral.toFixed(2)}, Withdrawn=${totalWithdrawn.toFixed(2)} -> roiBalance=${roiBalance.toFixed(2)}`
    )
  }
  console.log(`  Updated ${profilesUpdated} profiles\n`)

  console.log('Backfill migration complete!')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
