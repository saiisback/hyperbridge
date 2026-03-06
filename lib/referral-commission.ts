import { Prisma } from '@prisma/client'

const L1_RATE = 0.03 // 3% for direct referrer
const L2_RATE = 0.01 // 1% for indirect referrer

/**
 * Pay first-deposit referral commissions (L1: 3%, L2: 1%).
 * Must be called inside a Prisma interactive transaction.
 * Only pays if this is the user's first completed deposit.
 */
export async function payFirstDepositReferralCommissions(
  tx: Prisma.TransactionClient,
  userId: string,
  amountInr: number,
  depositTransactionId: string
) {
  // Check if this is the first completed deposit
  const previousDeposit = await tx.transaction.findFirst({
    where: {
      userId,
      type: 'deposit',
      status: 'completed',
      id: { not: depositTransactionId },
    },
  })

  if (previousDeposit) return // Not first deposit, skip

  // Pay L1 referral commission to direct referrer
  const l1Referral = await tx.referral.findFirst({
    where: { refereeId: userId, level: 1 },
  })

  if (l1Referral) {
    const l1Commission = amountInr * L1_RATE

    await tx.transaction.create({
      data: {
        userId: l1Referral.referrerId,
        type: 'referral',
        amount: l1Commission,
        amountInr: l1Commission,
        token: 'INR',
        status: 'completed',
        dedupKey: `ref:${l1Referral.referrerId}:${userId}:instant`,
        metadata: {
          fromUserId: userId,
          level: 1,
          depositAmount: amountInr,
          rate: `${L1_RATE * 100}%`,
          type: 'instant',
        },
      },
    })

    await tx.profile.update({
      where: { userId: l1Referral.referrerId },
      data: {
        availableBalance: { increment: l1Commission },
        roiBalance: { increment: l1Commission },
        totalBalance: { increment: l1Commission },
      },
    })

    await tx.referral.update({
      where: { id: l1Referral.id },
      data: {
        totalEarnings: { increment: l1Commission },
      },
    })
  }

  // Pay L2 referral commission to indirect referrer
  const l2Referral = await tx.referral.findFirst({
    where: { refereeId: userId, level: 2 },
  })

  if (l2Referral) {
    const l2Commission = amountInr * L2_RATE

    await tx.transaction.create({
      data: {
        userId: l2Referral.referrerId,
        type: 'referral',
        amount: l2Commission,
        amountInr: l2Commission,
        token: 'INR',
        status: 'completed',
        dedupKey: `ref:${l2Referral.referrerId}:${userId}:instant`,
        metadata: {
          fromUserId: userId,
          level: 2,
          depositAmount: amountInr,
          rate: `${L2_RATE * 100}%`,
          type: 'instant',
        },
      },
    })

    await tx.profile.update({
      where: { userId: l2Referral.referrerId },
      data: {
        availableBalance: { increment: l2Commission },
        roiBalance: { increment: l2Commission },
        totalBalance: { increment: l2Commission },
      },
    })

    await tx.referral.update({
      where: { id: l2Referral.id },
      data: {
        totalEarnings: { increment: l2Commission },
      },
    })
  }
}
