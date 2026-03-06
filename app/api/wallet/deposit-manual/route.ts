import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const depositManualSchema = z.object({
  txHash: z.string().min(10, 'Please enter a valid transaction hash'),
  amount: z.string().min(1, 'Amount is required'),
  network: z.enum(['bep20', 'trc20'], { message: 'Invalid network' }),
})

const DEPOSIT_ADDRESSES: Record<string, string> = {
  bep20: (process.env.NEXT_PUBLIC_BEP20_DEPOSIT_ADDRESS || '0xef7063e1329331343fe88478421a2af15a725030').toLowerCase(),
  trc20: process.env.NEXT_PUBLIC_TRC20_DEPOSIT_ADDRESS || 'TZA7cFmFFtTsKrVkLqdSPSHpZzD8if189t',
}

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = rateLimit(`deposit-manual:${privyId}`, { limit: 10, windowSecs: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = depositManualSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { txHash, amount, network } = parsed.data

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const networkLabel = network === 'bep20' ? 'BEP-20 (BSC)' : 'TRC-20 (Tron)'

    let transaction
    try {
      transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: parseFloat(amount),
          token: 'USDT',
          status: 'pending',
          txHash: txHash.trim(),
          metadata: {
            network,
            networkLabel,
            method: 'manual',
            platformAddress: DEPOSIT_ADDRESSES[network],
          },
        },
      })
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Transaction already submitted' }, { status: 400 })
      }
      throw err
    }

    return NextResponse.json({
      success: true,
      transaction,
      message: `Deposit of ${amount} USDT via ${networkLabel} submitted. It will be credited after admin verification.`,
    })
  } catch (error) {
    console.error('Manual deposit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
