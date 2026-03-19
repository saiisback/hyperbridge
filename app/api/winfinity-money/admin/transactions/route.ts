import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { privyId } })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where: Record<string, unknown> = {
      metadata: { path: ['method'], equals: 'wm_bank_deposit' },
    }
    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      where.status = status
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true, profile: { select: { referralCode: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    // Stats
    const [pendingCount, completedToday, totalVolume] = await Promise.all([
      prisma.transaction.count({
        where: { ...where, status: 'pending' },
      }),
      prisma.transaction.count({
        where: {
          ...where,
          status: 'completed',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.transaction.aggregate({
        where: { ...where, status: 'completed' },
        _sum: { amountInr: true },
      }),
    ])

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        userName: tx.user.name,
        userEmail: tx.user.email,
        referralCode: tx.user.profile?.referralCode,
        amountInr: tx.amountInr?.toString(),
        cryptoAmount: tx.amount.toString(),
        token: tx.token,
        conversionRate: tx.conversionRate?.toString(),
        status: tx.status,
        utr: (tx.metadata as Record<string, unknown>)?.utr,
        remark: (tx.metadata as Record<string, unknown>)?.remark,
        createdAt: tx.createdAt,
      })),
      stats: {
        pendingCount,
        completedToday,
        totalVolume: totalVolume._sum.amountInr?.toString() || '0',
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin transactions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
