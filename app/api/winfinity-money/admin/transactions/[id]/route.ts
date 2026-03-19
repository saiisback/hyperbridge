import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['completed', 'failed']),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { privyId } })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.findUnique({ where: { id } })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const metadata = transaction.metadata as Record<string, unknown>
    if (metadata?.method !== 'wm_bank_deposit') {
      return NextResponse.json({ error: 'Not a Winfinity Money transaction' }, { status: 400 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is no longer pending' }, { status: 400 })
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    })
  } catch (error) {
    console.error('Admin update transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
