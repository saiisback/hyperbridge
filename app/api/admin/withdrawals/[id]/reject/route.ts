import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { Prisma } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const withdrawMetaSchema = z.object({
  roiDeduction: z.number().min(0).optional(),
}).passthrough()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error, user: adminUser } = await verifyAdmin(request)
  if (!authorized || !adminUser) {
    return NextResponse.json({ error }, { status: 403 })
  }

  // Rate limit: 10 rejections per 60 seconds per admin
  const rl = rateLimit(`reject:${adminUser.id}`, { limit: 10, windowSecs: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { id } = await params
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const reason = typeof body.reason === 'string' ? body.reason : ''

    // Atomic: verify status + reject transaction + refund balance (prevents TOCTOU race)
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
      })

      if (!transaction) {
        throw new Error('NOT_FOUND')
      }
      if (transaction.type !== 'withdraw') {
        throw new Error('NOT_WITHDRAWAL')
      }
      if (transaction.status !== 'pending') {
        throw new Error('NOT_PENDING')
      }

      await tx.transaction.update({
        where: { id },
        data: {
          status: 'failed',
          metadata: {
            ...(transaction.metadata as object),
            rejectedBy: adminUser.id,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason,
          },
        },
      })

      // Refund user's balance (use amountInr which is what was actually deducted)
      const refundAmount = new Prisma.Decimal((transaction.amountInr || transaction.amount).toString())
      const parsedMeta = withdrawMetaSchema.safeParse(transaction.metadata)
      const roiDeduction = parsedMeta.success ? (parsedMeta.data.roiDeduction ?? 0) : 0

      await tx.profile.update({
        where: { userId: transaction.userId },
        data: {
          availableBalance: { increment: refundAmount },
          roiBalance: { increment: roiDeduction },
          totalBalance: { increment: refundAmount },
        },
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return NextResponse.json({
      success: true,
      message: 'Withdrawal rejected and balance refunded',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }
      if (error.message === 'NOT_WITHDRAWAL') {
        return NextResponse.json({ error: 'Transaction is not a withdrawal' }, { status: 400 })
      }
      if (error.message === 'NOT_PENDING') {
        return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 })
      }
    }
    console.error('Reject withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
