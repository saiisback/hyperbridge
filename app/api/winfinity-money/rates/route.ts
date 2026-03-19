import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rates = await prisma.wmExchangeRate.findUnique({
      where: { id: 'default' },
    })

    if (!rates) {
      return NextResponse.json(
        { error: 'Exchange rates not configured' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ethRate: rates.ethRate.toString(),
      usdtRate: rates.usdtRate.toString(),
      updatedAt: rates.updatedAt,
    })
  } catch (error) {
    console.error('Get rates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
