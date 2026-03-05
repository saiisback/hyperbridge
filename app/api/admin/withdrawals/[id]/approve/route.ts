import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { rateLimit } from '@/lib/rate-limit'

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error, user: adminUser } = await verifyAdmin(request)
  if (!authorized || !adminUser) {
    return NextResponse.json({ error }, { status: 403 })
  }

  // Rate limit: 10 approvals per 60 seconds per admin
  const rl = rateLimit(`approve:${adminUser.id}`, { limit: 10, windowSecs: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { txHash } = body

    if (!txHash || !TX_HASH_REGEX.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 })
    }

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

    // Atomically claim this transaction to prevent concurrent approvals.
    const claimed = await prisma.transaction.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'completed',
        txHash,
        metadata: {
          ...(transaction.metadata as object),
          approvedBy: adminUser.id,
          approvedAt: new Date().toISOString(),
        },
      },
    })

    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Transaction is no longer pending' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: 'completed',
        amount: transaction.amount.toString(),
        txHash,
      },
    })
  } catch (error) {
    console.error('Approve withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
