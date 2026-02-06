import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { Prisma } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error, user: adminUser } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || ''

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.type !== 'withdraw') {
      return NextResponse.json({ error: 'Transaction is not a withdrawal' }, { status: 400 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 })
    }

    // Atomic: reject transaction + refund balance
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data: {
          status: 'failed',
          metadata: {
            ...(transaction.metadata as object),
            rejectedBy: adminUser!.id,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason,
          },
        },
      })

      // Refund user's balance
      await tx.profile.update({
        where: { userId: transaction.userId },
        data: {
          availableBalance: { increment: new Prisma.Decimal(transaction.amount.toString()) },
          totalBalance: { increment: new Prisma.Decimal(transaction.amount.toString()) },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Withdrawal rejected and balance refunded',
    })
  } catch (error) {
    console.error('Reject withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
