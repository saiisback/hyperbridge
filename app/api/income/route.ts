import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'

const referralMetaSchema = z.object({
  fromAddress: z.string().optional(),
  level: z.number().int().min(1).max(2).optional(),
  type: z.string().optional(),
}).passthrough()

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

    // Today's date boundaries
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Run all 8 independent queries in parallel
    const [
      roiAgg,
      todayRoiTx,
      firstDeposit,
      roiTransactions,
      referralAgg,
      l1Referrals,
      l2Referrals,
      referralTransactions,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'roi', status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.transaction.findFirst({
        where: {
          userId: user.id,
          type: 'roi',
          status: 'completed',
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.transaction.findFirst({
        where: { userId: user.id, type: 'deposit', status: 'completed' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id, type: 'roi', status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'referral', status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.referral.findMany({
        where: { referrerId: user.id, level: 1 },
      }),
      prisma.referral.findMany({
        where: { referrerId: user.id, level: 2 },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id, type: 'referral', status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    const totalRoiIncome = Number(roiAgg._sum.amount ?? 0)
    const todayRoi = todayRoiTx ? Number(todayRoiTx.amount) : 0
    const daysActive = firstDeposit
      ? Math.floor((Date.now() - firstDeposit.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const roiHistory = roiTransactions.map((tx) => ({
      date: tx.createdAt.toISOString().split('T')[0],
      amount: Number(tx.amount),
      percentage: '0.5%',
      status: 'credited',
    }))

    const totalReferralIncome = Number(referralAgg._sum.amount ?? 0)

    const level1Members = l1Referrals.length
    const level1Earnings = l1Referrals.reduce((sum, ref) => sum + Number(ref.totalEarnings), 0)

    const level2Members = l2Referrals.length
    const level2Earnings = l2Referrals.reduce((sum, ref) => sum + Number(ref.totalEarnings), 0)

    const referralHistory = referralTransactions.map((tx) => {
      const parsedMeta = referralMetaSchema.safeParse(tx.metadata)
      const meta = parsedMeta.success ? parsedMeta.data : null
      return {
        date: tx.createdAt.toISOString().split('T')[0],
        from: meta?.fromAddress || 'Unknown',
        amount: Number(tx.amount),
        level: meta?.level ?? 1,
        type: meta?.type || 'instant',
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
