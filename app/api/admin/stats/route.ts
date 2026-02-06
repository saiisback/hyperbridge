import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      totalUsers,
      newUsersLast30d,
      depositAgg,
      balanceAgg,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.transaction.aggregate({
        where: { type: 'deposit', status: 'completed' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.profile.aggregate({
        _sum: { totalBalance: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'withdraw', status: 'pending' },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      totalUsers,
      newUsersLast30d,
      totalDeposits: depositAgg._sum.amount?.toString() || '0',
      totalDepositCount: depositAgg._count,
      totalBalance: balanceAgg._sum.totalBalance?.toString() || '0',
      pendingWithdrawalCount: pendingWithdrawals._count,
      pendingWithdrawalSum: pendingWithdrawals._sum.amount?.toString() || '0',
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
