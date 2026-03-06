import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { TransactionStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'pending') as TransactionStatus
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const skip = (page - 1) * limit

    const where = {
      type: 'deposit' as const,
      token: 'INR',
      status,
      metadata: {
        path: ['method'],
        equals: 'bank_inr',
      },
    }

    const [deposits, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, primaryWallet: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      deposits: deposits.map((d) => ({
        id: d.id,
        amountInr: d.amountInr?.toString() ?? '0',
        amount: d.amount.toString(),
        conversionRate: d.conversionRate?.toString() ?? null,
        token: d.token,
        status: d.status,
        metadata: d.metadata,
        createdAt: d.createdAt,
        user: d.user,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Admin INR deposits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
