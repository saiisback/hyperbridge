import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  const resolved = await params
  const parsed = paramsSchema.safeParse(resolved)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }
  const { id } = parsed.data

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [txnGroups, recentTransactions, referralAgg, referrer] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type', 'status'],
        where: { userId: id },
        _count: { _all: true },
        _sum: { amount: true, amountInr: true },
      }),
      prisma.transaction.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.referral.aggregate({
        where: { referrerId: id },
        _count: { _all: true },
        _sum: { totalEarnings: true },
      }),
      user.profile?.referredBy
        ? prisma.user.findFirst({
            where: {
              profile: { referralCode: user.profile.referredBy },
            },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),
    ])

    const byType: Record<
      string,
      {
        count: number
        totalAmount: string
        totalAmountInr: string
        completed: number
        pending: number
        failed: number
      }
    > = {
      deposit: { count: 0, totalAmount: '0', totalAmountInr: '0', completed: 0, pending: 0, failed: 0 },
      withdraw: { count: 0, totalAmount: '0', totalAmountInr: '0', completed: 0, pending: 0, failed: 0 },
      roi: { count: 0, totalAmount: '0', totalAmountInr: '0', completed: 0, pending: 0, failed: 0 },
      referral: { count: 0, totalAmount: '0', totalAmountInr: '0', completed: 0, pending: 0, failed: 0 },
    }

    let totalTxnCount = 0
    for (const g of txnGroups) {
      const bucket = byType[g.type]
      if (!bucket) continue
      const gCount = g._count._all
      totalTxnCount += gCount
      bucket.count += gCount
      bucket.totalAmount = (parseFloat(bucket.totalAmount) + parseFloat(g._sum.amount?.toString() || '0')).toString()
      bucket.totalAmountInr = (
        parseFloat(bucket.totalAmountInr) + parseFloat(g._sum.amountInr?.toString() || '0')
      ).toString()
      if (g.status === 'completed') bucket.completed += gCount
      else if (g.status === 'pending') bucket.pending += gCount
      else if (g.status === 'failed') bucket.failed += gCount
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        primaryWallet: user.primaryWallet,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        kycVerified: user.kycVerified,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      balances: {
        totalBalance: user.profile?.totalBalance?.toString() || '0',
        availableBalance: user.profile?.availableBalance?.toString() || '0',
        roiBalance: user.profile?.roiBalance?.toString() || '0',
        totalInvested: user.profile?.totalInvested?.toString() || '0',
      },
      transactionStats: {
        total: totalTxnCount,
        byType,
      },
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        amountInr: t.amountInr?.toString() || null,
        token: t.token,
        status: t.status,
        txHash: t.txHash,
        createdAt: t.createdAt,
      })),
      referral: {
        referralCode: user.profile?.referralCode || null,
        referrer: referrer ? { id: referrer.id, name: referrer.name, email: referrer.email } : null,
        refereeCount: referralAgg._count._all,
        totalReferralEarnings: referralAgg._sum.totalEarnings?.toString() || '0',
      },
    })
  } catch (err) {
    console.error('Admin user detail error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  const resolved = await params
  const parsed = paramsSchema.safeParse(resolved)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }
  const { id } = parsed.data

  try {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin user delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
