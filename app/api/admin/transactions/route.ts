import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { z } from 'zod'

const querySchema = z.object({
  type: z.enum(['deposit', 'withdraw', 'roi', 'referral']).nullable().default(null),
  status: z.enum(['pending', 'completed', 'failed']).nullable().default(null),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      type: searchParams.get('type') || null,
      status: searchParams.get('status') || null,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }
    const { type, status, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (status) where.status = status

    const [transactions, total] = await Promise.all([
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
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        amountInr: t.amountInr?.toString() ?? null,
        conversionRate: t.conversionRate?.toString() ?? null,
        token: t.token,
        status: t.status,
        txHash: t.txHash,
        walletAddress: t.walletAddress,
        metadata: t.metadata,
        createdAt: t.createdAt,
        user: t.user,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Admin transactions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
