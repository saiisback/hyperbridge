import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'

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

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'completed',
        metadata: {
          ...(transaction.metadata as object),
          approvedBy: adminUser!.id,
          approvedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: updated.id,
        status: updated.status,
        amount: updated.amount.toString(),
      },
    })
  } catch (error) {
    console.error('Approve withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
