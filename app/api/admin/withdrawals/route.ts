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
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where = {
      type: 'withdraw' as const,
      status,
    }

    const [withdrawals, total] = await Promise.all([
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
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        amountInr: w.amountInr?.toString() ?? null,
        conversionRate: w.conversionRate?.toString() ?? null,
        token: w.token,
        status: w.status,
        walletAddress: w.walletAddress,
        metadata: w.metadata,
        createdAt: w.createdAt,
        user: w.user,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Admin withdrawals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
