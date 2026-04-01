import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { getDepositLockDate, LOCK_DURATION_MONTHS } from '@/lib/wallet-utils'
import { payFirstDepositReferralCommissions } from '@/lib/referral-commission'
import { z } from 'zod'

const addBalanceSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const { authorized, error, user: adminUser } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = addBalanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { userId, amount, note } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const lockedUntil = getDepositLockDate()

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'deposit',
          amount,
          amountInr: amount,
          status: 'completed',
          metadata: {
            method: 'admin_add',
            note: note || 'Admin balance addition',
            addedBy: adminUser?.id,
            addedAt: new Date().toISOString(),
            lockedUntil: lockedUntil.toISOString(),
          },
        },
      })

      const updatedProfile = await tx.profile.update({
        where: { userId },
        data: {
          totalBalance: { increment: amount },
          totalInvested: { increment: amount },
        },
      })

      await payFirstDepositReferralCommissions(tx, userId, amount, transaction.id)

      return { transaction, profile: updatedProfile }
    })

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      profile: {
        totalBalance: result.profile.totalBalance.toString(),
        totalInvested: result.profile.totalInvested.toString(),
      },
      lockInfo: {
        lockedUntil: lockedUntil.toISOString(),
        lockDurationMonths: LOCK_DURATION_MONTHS,
      },
    })
  } catch (error) {
    console.error('Admin add-balance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
