import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { computeWithdrawalInfo } from '@/lib/wallet-utils'

export async function GET(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get total ROI income
    const roiAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'roi', status: 'completed' },
      _sum: { amount: true },
    })
    const totalRoiIncome = Number(roiAgg._sum.amount ?? 0)

    // Get total referral income
    const referralAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'referral', status: 'completed' },
      _sum: { amount: true },
    })
    const totalReferralIncome = Number(referralAgg._sum.amount ?? 0)

    // Get team size
    const teamSize = await prisma.referral.count({
      where: { referrerId: user.id },
    })

    // Get recent activities (last 10 transactions)
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const recentActivities = recentTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amountInr ? Number(tx.amountInr) : Number(tx.amount),
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    }))

    // Monthly earnings (last 7 months)
    const sevenMonthsAgo = new Date()
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6)
    sevenMonthsAgo.setDate(1)
    sevenMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        status: 'completed',
        type: { in: ['roi', 'referral'] },
        createdAt: { gte: sevenMonthsAgo },
      },
      orderBy: { createdAt: 'asc' },
    })

    const monthlyMap: Record<string, { roi: number; referral: number }> = {}
    for (const tx of monthlyTransactions) {
      const monthKey = tx.createdAt.toLocaleString('en-US', { month: 'short' })
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { roi: 0, referral: 0 }
      }
      if (tx.type === 'roi') {
        monthlyMap[monthKey].roi += Number(tx.amount)
      } else if (tx.type === 'referral') {
        monthlyMap[monthKey].referral += Number(tx.amount)
      }
    }

    const monthlyEarnings = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      roi: parseFloat(data.roi.toFixed(8)),
      referral: parseFloat(data.referral.toFixed(8)),
    }))

    // Balance history (last 7 days)
    const balanceHistory: { day: string; balance: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const endOfDate = new Date(date)
      endOfDate.setHours(23, 59, 59, 999)

      // Sum all completed transactions up to end of this day
      const txSum = await prisma.transaction.aggregate({
        where: {
          userId: user.id,
          status: 'completed',
          createdAt: { lte: endOfDate },
        },
        _sum: { amount: true },
      })

      // For withdrawals, they reduce balance so we need to handle sign
      const withdrawSum = await prisma.transaction.aggregate({
        where: {
          userId: user.id,
          status: 'completed',
          type: 'withdraw',
          createdAt: { lte: endOfDate },
        },
        _sum: { amount: true },
      })

      const totalIn = Number(txSum._sum.amount ?? 0)
      const totalWithdraw = Number(withdrawSum._sum.amount ?? 0)
      // Withdrawals are stored as positive amounts but reduce balance, so subtract twice
      const balance = totalIn - 2 * totalWithdraw

      balanceHistory.push({
        day: date.toLocaleString('en-US', { weekday: 'short' }),
        balance: parseFloat(balance.toFixed(8)),
      })
    }

    // Compute withdrawal breakdown
    const withdrawalInfo = await computeWithdrawalInfo(prisma, user.id)

    // Portfolio distribution
    const totalInvested = Number(user.profile.totalInvested)
    const availableBalance = Number(user.profile.availableBalance)

    const portfolioData = [
      { name: 'Locked Principal', value: withdrawalInfo.lockedPrincipal, color: '#ef4444' },
      { name: 'Unlocked Principal', value: withdrawalInfo.unlockedPrincipal, color: '#f97316' },
      { name: 'ROI Earnings', value: totalRoiIncome, color: '#22c55e' },
      { name: 'Referral Earnings', value: totalReferralIncome, color: '#3b82f6' },
    ]

    return NextResponse.json({
      totalBalance: Number(user.profile.totalBalance),
      availableBalance,
      totalInvested,
      totalRoiIncome,
      totalReferralIncome,
      teamSize,
      recentActivities,
      monthlyEarnings,
      balanceHistory,
      portfolioData,
      // New withdrawal breakdown fields
      roiBalance: withdrawalInfo.roiBalance,
      lockedPrincipal: withdrawalInfo.lockedPrincipal,
      unlockedPrincipal: withdrawalInfo.unlockedPrincipal,
      availableWithdrawal: withdrawalInfo.availableWithdrawal,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
