import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

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

    // Total ROI income
    const roiAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'roi', status: 'completed' },
      _sum: { amount: true },
    })
    const totalRoiIncome = Number(roiAgg._sum.amount ?? 0)

    // Today's ROI
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setUTCHours(23, 59, 59, 999)

    const todayRoiTx = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        type: 'roi',
        status: 'completed',
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    })
    const todayRoi = todayRoiTx ? Number(todayRoiTx.amount) : 0

    // Days active (since first deposit)
    const firstDeposit = await prisma.transaction.findFirst({
      where: { userId: user.id, type: 'deposit', status: 'completed' },
      orderBy: { createdAt: 'asc' },
    })
    const daysActive = firstDeposit
      ? Math.floor((Date.now() - firstDeposit.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // ROI history (last 30)
    const roiTransactions = await prisma.transaction.findMany({
      where: { userId: user.id, type: 'roi', status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const roiHistory = roiTransactions.map((tx) => ({
      date: tx.createdAt.toISOString().split('T')[0],
      amount: Number(tx.amount),
      percentage: '0.5%',
      status: 'credited',
    }))

    // Total referral income
    const referralAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'referral', status: 'completed' },
      _sum: { amount: true },
    })
    const totalReferralIncome = Number(referralAgg._sum.amount ?? 0)

    // L1 referral stats
    const l1Referrals = await prisma.referral.findMany({
      where: { referrerId: user.id, level: 1 },
    })
    const level1Members = l1Referrals.length
    const level1Earnings = l1Referrals.reduce((sum, ref) => sum + Number(ref.totalEarnings), 0)

    // L2 referral stats
    const l2Referrals = await prisma.referral.findMany({
      where: { referrerId: user.id, level: 2 },
    })
    const level2Members = l2Referrals.length
    const level2Earnings = l2Referrals.reduce((sum, ref) => sum + Number(ref.totalEarnings), 0)

    // Referral history (last 30)
    const referralTransactions = await prisma.transaction.findMany({
      where: { userId: user.id, type: 'referral', status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const referralHistory = referralTransactions.map((tx) => {
      const meta = tx.metadata as Record<string, unknown> | null
      return {
        date: tx.createdAt.toISOString().split('T')[0],
        from: (meta?.fromAddress as string) || 'Unknown',
        amount: Number(tx.amount),
        level: (meta?.level as number) || 1,
        type: (meta?.type as string) || 'instant',
      }
    })

    return NextResponse.json({
      totalRoiIncome,
      todayRoi,
      totalInvested: Number(user.profile.totalInvested),
      dailyRoiRate: 0.5,
      daysActive,
      roiHistory,
      totalReferralIncome,
      directMembers: level1Members,
      directEarnings: level1Earnings,
      level2Members,
      level2Earnings,
      referralHistory,
      referralCode: user.profile.referralCode,
    })
  } catch (error) {
    console.error('Income API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
