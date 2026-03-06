import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { getPlatformBankDetails } from '@/lib/bank-config'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const depositInrSchema = z.object({
  amount: z.number().min(100, 'Minimum deposit is ₹100'),
})

function generateRemarkCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = rateLimit(`deposit-inr:${privyId}`, { limit: 5, windowSecs: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = depositInrSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const { amount } = parsed.data

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate remark code with retry on collision (unique constraint on dedupKey)
    let transaction
    let remarkCode: string = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      remarkCode = generateRemarkCode()
      try {
        transaction = await prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'deposit',
            amount: 0, // Will be set to USDT amount on approval
            amountInr: amount,
            token: 'INR',
            status: 'pending',
            dedupKey: `inr-remark:${remarkCode}`,
            metadata: {
              method: 'bank_inr',
              remarkCode,
            },
          },
        })
        break
      } catch (err: any) {
        if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
          if (attempt === 4) {
            return NextResponse.json(
              { error: 'Failed to generate unique remark code. Please try again.' },
              { status: 500 }
            )
          }
          continue
        }
        throw err
      }
    }

    const bankDetails = getPlatformBankDetails()

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction!.id,
        amount,
        remarkCode,
        status: 'pending',
      },
      bankDetails,
    })
  } catch (error) {
    console.error('INR deposit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
