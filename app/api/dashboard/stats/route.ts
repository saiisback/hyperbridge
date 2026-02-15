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

    const now = new Date()

    // Run all independent queries in parallel (consolidated from 8+ queries to 4)
    const [teamSize, recentTransactions, allCompletedTx, withdrawalInfo] =
      await Promise.all([
        prisma.referral.count({
          where: { referrerId: user.id },
        }),
        prisma.transaction.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.transaction.findMany({
          where: {
            userId: user.id,
            status: 'completed',
          },
          select: { amount: true, createdAt: true, type: true },
          orderBy: { createdAt: 'asc' },
        }),
        computeWithdrawalInfo(prisma, user.id, user.profile),
      ])

    const recentActivities = recentTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amountInr ? Number(tx.amountInr) : Number(tx.amount),
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    }))

    // Single pass over allCompletedTx: derive income totals, monthly earnings, and balance history
    const sevenMonthsAgo = new Date()
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6)
    sevenMonthsAgo.setDate(1)
    sevenMonthsAgo.setHours(0, 0, 0, 0)

    const dayBoundaries: Date[] = []
    const balanceHistory: { day: string; balance: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const endOfDate = new Date(date)
      endOfDate.setHours(23, 59, 59, 999)
      dayBoundaries.push(endOfDate)
      balanceHistory.push({
        day: date.toLocaleString('en-US', { weekday: 'short' }),
        balance: 0,
      })
    }

    let totalRoiIncome = 0
    let totalReferralIncome = 0
    const monthlyMap: Record<string, { roi: number; referral: number }> = {}
    let runningBalance = 0
    let dayIdx = 0

    for (const tx of allCompletedTx) {
      const amount = Number(tx.amount)

      // Snapshot balance for any day boundaries this transaction has passed
      while (dayIdx < dayBoundaries.length && tx.createdAt > dayBoundaries[dayIdx]) {
        balanceHistory[dayIdx].balance = parseFloat(runningBalance.toFixed(8))
        dayIdx++
      }

      // Update running balance (withdrawals subtract, everything else adds)
      runningBalance += tx.type === 'withdraw' ? -amount : amount

      // Aggregate income totals
      if (tx.type === 'roi') totalRoiIncome += amount
      else if (tx.type === 'referral') totalReferralIncome += amount

      // Monthly earnings (last 7 months, roi/referral only)
      if (tx.createdAt >= sevenMonthsAgo && (tx.type === 'roi' || tx.type === 'referral')) {
        const monthKey = tx.createdAt.toLocaleString('en-US', { month: 'short' })
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { roi: 0, referral: 0 }
        if (tx.type === 'roi') monthlyMap[monthKey].roi += amount
        else monthlyMap[monthKey].referral += amount
      }
    }

    // Fill remaining day boundaries after all transactions
    while (dayIdx < dayBoundaries.length) {
      balanceHistory[dayIdx].balance = parseFloat(runningBalance.toFixed(8))
      dayIdx++
    }

    const monthlyEarnings = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      roi: parseFloat(data.roi.toFixed(8)),
      referral: parseFloat(data.referral.toFixed(8)),
    }))

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
