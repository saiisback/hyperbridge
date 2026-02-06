import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const privyId = request.nextUrl.searchParams.get('privyId')
    if (!privyId) {
      return NextResponse.json({ error: 'privyId is required' }, { status: 400 })
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

    // Referral earnings grouped by level
    const referrals = await prisma.referral.findMany({
      where: { referrerId: user.id },
    })

    const referralEarningsByLevel: Record<number, { members: number; earnings: number }> = {}
    const levelPercentages: Record<number, string> = { 1: '10%', 2: '5%', 3: '2%' }

    for (const ref of referrals) {
      if (!referralEarningsByLevel[ref.level]) {
        referralEarningsByLevel[ref.level] = { members: 0, earnings: 0 }
      }
      referralEarningsByLevel[ref.level].members++
      referralEarningsByLevel[ref.level].earnings += Number(ref.totalEarnings)
    }

    const referralEarnings = [1, 2, 3].map((level) => ({
      level,
      members: referralEarningsByLevel[level]?.members ?? 0,
      percentage: levelPercentages[level],
      earnings: referralEarningsByLevel[level]?.earnings ?? 0,
    }))

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
        level: (meta?.level as number) || 1,
        amount: Number(tx.amount),
      }
    })

    // Team size
    const teamSize = await prisma.referral.count({
      where: { referrerId: user.id },
    })

    return NextResponse.json({
      totalRoiIncome,
      todayRoi,
      totalInvested: Number(user.profile.totalInvested),
      dailyRoiRate: 0.5,
      daysActive,
      roiHistory,
      totalReferralIncome,
      referralEarnings,
      referralHistory,
      referralCode: user.profile.referralCode,
      teamSize,
    })
  } catch (error) {
    console.error('Income API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
