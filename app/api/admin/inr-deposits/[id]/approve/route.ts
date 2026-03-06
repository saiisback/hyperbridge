import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { getDepositLockDate } from '@/lib/wallet-utils'
import { payFirstDepositReferralCommissions } from '@/lib/referral-commission'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  const { id } = await params

  try {
    // Atomically claim the pending transaction
    const transaction = await prisma.transaction.findUnique({ where: { id } })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 })
    }

    const metadata = transaction.metadata as Record<string, unknown> | null
    if (metadata?.method !== 'bank_inr') {
      return NextResponse.json({ error: 'Not an INR bank deposit' }, { status: 400 })
    }

    const amountInr = Number(transaction.amountInr ?? 0)
    if (amountInr <= 0) {
      return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 })
    }

    // Fetch live USDT/INR rate
    const priceData = await getTokenPriceInINR('USDT')
    const usdtAmount = amountInr / priceData.inrPrice
    const lockedUntil = getDepositLockDate()

    const result = await prisma.$transaction(async (tx) => {
      // Atomically claim: only update if still pending
      const claimed = await tx.transaction.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'completed',
          amount: usdtAmount,
          conversionRate: priceData.inrPrice,
          metadata: {
            ...metadata,
            priceFetchedAt: priceData.fetchedAt,
            lockedUntil: lockedUntil.toISOString(),
            approvedAt: new Date().toISOString(),
          },
        },
      })

      if (claimed.count === 0) {
        throw new Error('ALREADY_PROCESSED')
      }

      const updatedProfile = await tx.profile.update({
        where: { userId: transaction.userId },
        data: {
          totalBalance: { increment: amountInr },
          totalInvested: { increment: amountInr },
        },
      })

      await payFirstDepositReferralCommissions(tx, transaction.userId, amountInr, id)

      return { profile: updatedProfile }
    })

    return NextResponse.json({
      success: true,
      conversion: {
        amountInr,
        usdtAmount,
        rate: priceData.inrPrice,
        convertedAt: priceData.fetchedAt,
      },
      profile: result.profile,
    })
  } catch (error: any) {
    if (error?.message === 'ALREADY_PROCESSED') {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 })
    }
    console.error('INR deposit approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
