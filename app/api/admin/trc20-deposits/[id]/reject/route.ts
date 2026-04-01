import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'

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
    const body = await request.json()
    const reason = body.reason || ''

    const transaction = await prisma.transaction.findUnique({ where: { id } })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 })
    }

    const metadata = transaction.metadata as Record<string, unknown> | null
    if (metadata?.network !== 'trc20') {
      return NextResponse.json({ error: 'Not a TRC-20 deposit' }, { status: 400 })
    }

    await prisma.transaction.update({
      where: { id },
      data: {
        status: 'failed',
        metadata: {
          ...metadata,
          rejectionReason: reason,
          rejectedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('TRC-20 deposit reject error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
