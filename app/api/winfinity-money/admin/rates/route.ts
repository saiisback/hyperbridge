import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'

const updateRatesSchema = z.object({
  ethRate: z.number().positive('ETH rate must be positive'),
  usdtRate: z.number().positive('USDT rate must be positive'),
})

export async function PUT(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const user = await prisma.user.findUnique({ where: { privyId } })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateRatesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { ethRate, usdtRate } = parsed.data

    const rates = await prisma.wmExchangeRate.upsert({
      where: { id: 'default' },
      create: { id: 'default', ethRate, usdtRate },
      update: { ethRate, usdtRate },
    })

    return NextResponse.json({
      ethRate: rates.ethRate.toString(),
      usdtRate: rates.usdtRate.toString(),
      updatedAt: rates.updatedAt,
    })
  } catch (error) {
    console.error('Update rates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
