import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const L1_RATE = 0.03 // 3% monthly on referee's totalInvested
const L2_RATE = 0.01 // 1% monthly on referee's totalInvested

async function handleMonthlyReferral(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const monthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`

    // Find all profiles with totalInvested > 0 (these are the referees whose referrers get paid)
    const investedProfiles = await prisma.profile.findMany({
      where: {
        totalInvested: { gt: 0 },
      },
      include: {
        user: {
          select: { id: true, isActive: true },
        },
      },
    })

    let l1Credited = 0
    let l2Credited = 0
    let skipped = 0
    const errors: string[] = []

    for (const profile of investedProfiles) {
      if (!profile.user.isActive) {
        skipped++
        continue
      }

      const refereeId = profile.user.id
      const totalInvested = Number(profile.totalInvested)

      // Find all referrals where this user is the referee
      const referrals = await prisma.referral.findMany({
        where: { refereeId },
      })

      for (const referral of referrals) {
        try {
          const rate = referral.level === 1 ? L1_RATE : L2_RATE
          const commission = totalInvested * rate

          if (commission <= 0) continue

          // Check if already paid this month for this referrer-referee pair
          const existingPayout = await prisma.transaction.findFirst({
            where: {
              userId: referral.referrerId,
              type: 'referral',
              status: 'completed',
              metadata: {
                path: ['fromUserId'],
                equals: refereeId,
              },
              AND: {
                metadata: {
                  path: ['monthKey'],
                  equals: monthKey,
                },
              },
            },
          })

          if (existingPayout) {
            skipped++
            continue
          }

          await prisma.$transaction([
            prisma.transaction.create({
              data: {
                userId: referral.referrerId,
                type: 'referral',
                amount: commission,
                amountInr: commission,
                token: 'INR',
                status: 'completed',
                metadata: {
                  fromUserId: refereeId,
                  level: referral.level,
                  totalInvested,
                  rate: `${rate * 100}%`,
                  type: 'monthly',
                  monthKey,
                },
              },
            }),
            prisma.profile.update({
              where: { userId: referral.referrerId },
              data: {
                availableBalance: { increment: commission },
                roiBalance: { increment: commission },
                totalBalance: { increment: commission },
              },
            }),
            prisma.referral.update({
              where: { id: referral.id },
              data: {
                totalEarnings: { increment: commission },
              },
            }),
          ])

          if (referral.level === 1) l1Credited++
          else l2Credited++
        } catch (err) {
          errors.push(`Referral ${referral.id}: ${(err as Error).message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      monthKey,
      totalProfiles: investedProfiles.length,
      l1Credited,
      l2Credited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Monthly referral cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Vercel Cron calls GET
export async function GET(request: NextRequest) {
  return handleMonthlyReferral(request)
}

// Manual calls use POST
export async function POST(request: NextRequest) {
  return handleMonthlyReferral(request)
}
