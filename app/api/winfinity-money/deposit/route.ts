import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'

const depositSchema = z.object({
  amountInr: z.number().min(100, 'Minimum deposit is ₹100'),
  token: z.enum(['ETH', 'USDT'], { message: 'Token must be ETH or USDT' }),
})

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = depositSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { amountInr, token } = parsed.data

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'User not found. Please sign up on the main app first.' }, { status: 404 })
    }

    // Get current exchange rate
    const rates = await prisma.wmExchangeRate.findUnique({
      where: { id: 'default' },
    })

    if (!rates) {
      return NextResponse.json({ error: 'Exchange rates not configured. Please contact admin.' }, { status: 503 })
    }

    const rate = token === 'ETH' ? rates.ethRate : rates.usdtRate
    const cryptoAmount = Number(amountInr) / Number(rate)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const remark = user.profile.referralCode || user.id.slice(0, 8)

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: cryptoAmount,
        amountInr,
        conversionRate: rate,
        token,
        status: 'pending',
        metadata: {
          method: 'wm_bank_deposit',
          remark,
          expiresAt,
          utr: null,
        },
      },
    })

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        amountInr,
        cryptoAmount: cryptoAmount.toFixed(8),
        token,
        conversionRate: rate.toString(),
        remark,
        expiresAt,
        status: 'pending',
      },
    })
  } catch (error) {
    console.error('WM deposit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
