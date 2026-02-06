import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAILY_ROI_RATE = 0.005 // 0.5%

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if today is a weekday (Mon=1 to Fri=5)
    const today = new Date()
    const dayOfWeek = today.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        message: 'Skipped - weekend',
        day: dayOfWeek === 0 ? 'Sunday' : 'Saturday',
      })
    }

    // Get start and end of today (UTC)
    const startOfDay = new Date(today)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(today)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Find all profiles with totalInvested > 0
    const profiles = await prisma.profile.findMany({
      where: {
        totalInvested: { gt: 0 },
      },
      include: {
        user: {
          select: { id: true, isActive: true },
        },
      },
    })

    let credited = 0
    let skipped = 0
    const errors: string[] = []

    for (const profile of profiles) {
      if (!profile.user.isActive) {
        skipped++
        continue
      }

      try {
        // Check if ROI was already credited today
        const existingRoi = await prisma.transaction.findFirst({
          where: {
            userId: profile.user.id,
            type: 'roi',
            status: 'completed',
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        })

        if (existingRoi) {
          skipped++
          continue
        }

        const roiAmount = Number(profile.totalInvested) * DAILY_ROI_RATE

        // Create ROI transaction and update balances atomically
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              userId: profile.user.id,
              type: 'roi',
              amount: roiAmount,
              status: 'completed',
              metadata: {
                dailyRate: DAILY_ROI_RATE,
                totalInvested: Number(profile.totalInvested),
                date: today.toISOString().split('T')[0],
              },
            },
          }),
          prisma.profile.update({
            where: { userId: profile.user.id },
            data: {
              availableBalance: { increment: roiAmount },
              totalBalance: { increment: roiAmount },
            },
          }),
        ])

        credited++
      } catch (err) {
        errors.push(`User ${profile.user.id}: ${(err as Error).message}`)
      }
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      totalProfiles: profiles.length,
      credited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Daily ROI cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
