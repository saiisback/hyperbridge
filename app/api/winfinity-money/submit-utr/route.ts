import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'

const submitUtrSchema = z.object({
  transactionId: z.string().uuid(),
  utr: z.string().min(6, 'UTR must be at least 6 characters').max(30),
})

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = submitUtrSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { transactionId, utr } = parsed.data

    const user = await prisma.user.findUnique({ where: { privyId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction || transaction.userId !== user.id) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is no longer pending' }, { status: 400 })
    }

    // Check if transaction has expired
    const metadata = transaction.metadata as Record<string, unknown>
    if (metadata.expiresAt && new Date(metadata.expiresAt as string) < new Date()) {
      // Auto-cancel expired transaction
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          metadata: { ...metadata, utr: null, failReason: 'expired' },
        },
      })
      return NextResponse.json({ error: 'Transaction has expired. Please start a new deposit.' }, { status: 400 })
    }

    // Update transaction with UTR
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        metadata: { ...metadata, utr },
      },
    })

    return NextResponse.json({ success: true, message: 'UTR submitted. Awaiting admin confirmation.' })
  } catch (error) {
    console.error('Submit UTR error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
