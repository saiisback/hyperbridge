import { Prisma } from '@prisma/client'

const LOCK_DURATION_MONTHS = 4

/**
 * Compute withdrawal info for a user, including ROI balance,
 * locked/unlocked principal, and available withdrawal amount.
 */
export async function computeWithdrawalInfo(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const now = new Date()

  // Read profile
  const profile = await tx.profile.findUniqueOrThrow({
    where: { userId },
  })
  const roiBalance = Number(profile.roiBalance)

  // Get all completed deposit transactions
  const deposits = await tx.transaction.findMany({
    where: { userId, type: 'deposit', status: 'completed' },
  })

  let lockedPrincipal = 0
  let unlockedPrincipal = 0

  for (const dep of deposits) {
    const meta = dep.metadata as Record<string, unknown> | null
    const lockedUntilStr = meta?.lockedUntil as string | undefined
    const amountInr = Number(dep.amountInr ?? dep.amount)

    if (lockedUntilStr) {
      const lockedUntil = new Date(lockedUntilStr)
      if (now >= lockedUntil) {
        unlockedPrincipal += amountInr
      } else {
        lockedPrincipal += amountInr
      }
    } else {
      // Legacy deposits without lockedUntil — treat as unlocked
      unlockedPrincipal += amountInr
    }
  }

  // Total withdrawn (completed + pending withdrawals)
  const withdrawAgg = await tx.transaction.aggregate({
    where: {
      userId,
      type: 'withdraw',
      status: { in: ['completed', 'pending'] },
    },
    _sum: { amountInr: true },
  })
  const totalWithdrawn = Number(withdrawAgg._sum.amountInr ?? 0)

  const availableWithdrawal = Math.max(
    0,
    roiBalance + unlockedPrincipal - totalWithdrawn
  )

  return {
    roiBalance,
    lockedPrincipal,
    unlockedPrincipal,
    totalWithdrawn,
    availableWithdrawal,
  }
}

/**
 * Calculate the lock-until date for a new deposit (4 months from now).
 */
export function getDepositLockDate(from: Date = new Date()): Date {
  const lockDate = new Date(from)
  lockDate.setMonth(lockDate.getMonth() + LOCK_DURATION_MONTHS)
  return lockDate
}

export { LOCK_DURATION_MONTHS }
