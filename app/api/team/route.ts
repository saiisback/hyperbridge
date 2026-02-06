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

    // Get referrals by level with referee details
    const referrals = await prisma.referral.findMany({
      where: { referrerId: user.id },
      include: {
        referee: {
          select: {
            primaryWallet: true,
            isActive: true,
            createdAt: true,
            profile: {
              select: { totalInvested: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    type TeamMember = {
      address: string
      joinDate: string
      investment: number
      status: string
    }

    const levels: Record<number, TeamMember[]> = { 1: [], 2: [], 3: [] }

    for (const ref of referrals) {
      const level = ref.level
      if (level < 1 || level > 3) continue

      levels[level].push({
        address: ref.referee.primaryWallet
          ? `${ref.referee.primaryWallet.slice(0, 6)}...${ref.referee.primaryWallet.slice(-4)}`
          : 'No wallet',
        joinDate: ref.createdAt.toISOString().split('T')[0],
        investment: Number(ref.referee.profile?.totalInvested ?? 0),
        status: ref.referee.isActive ? 'active' : 'inactive',
      })
    }

    const totalCount = referrals.length

    return NextResponse.json({
      levels,
      counts: {
        level1: levels[1].length,
        level2: levels[2].length,
        level3: levels[3].length,
        total: totalCount,
      },
      referralCode: user.profile.referralCode,
    })
  } catch (error) {
    console.error('Team API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
