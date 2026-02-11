import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getTokenPriceInINR } from '@/lib/crypto-price'

interface WithdrawRequest {
  privyId: string
  amount: string
  walletAddress: string
  token?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json()
    const { privyId, amount, walletAddress, token } = body

    if (!privyId || !amount || !walletAddress) {
      return NextResponse.json(
        { error: 'privyId, amount, and walletAddress are required' },
        { status: 400 }
      )
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const availableBalance = new Prisma.Decimal(user.profile.availableBalance)
    const withdrawAmount = new Prisma.Decimal(amount)

    if (availableBalance.lessThan(withdrawAmount)) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // Fetch real-time INR conversion rate
    const selectedToken = token || 'USDT'
    let inrPrice: number
    let priceFetchedAt: string
    try {
      const priceData = await getTokenPriceInINR(selectedToken)
      inrPrice = priceData.inrPrice
      priceFetchedAt = priceData.fetchedAt
    } catch (priceError) {
      console.error('Failed to fetch INR price:', priceError)
      return NextResponse.json(
        { error: 'Failed to fetch real-time INR conversion rate. Please try again.' },
        { status: 500 }
      )
    }

    const amountInr = parseFloat(amount) * inrPrice

    // Atomic transaction: create withdrawal record + deduct balance
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdraw',
          amount: withdrawAmount,
          amountInr,
          conversionRate: inrPrice,
          token: selectedToken,
          status: 'pending',
          walletAddress,
          metadata: { requestedAt: new Date().toISOString(), priceFetchedAt },
        },
      })

      await tx.profile.update({
        where: { userId: user.id },
        data: {
          availableBalance: { decrement: amountInr },
          totalBalance: { decrement: amountInr },
        },
      })

      return transaction
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        type: result.type,
        amount: result.amount.toString(),
        status: result.status,
        walletAddress: result.walletAddress,
        createdAt: result.createdAt,
      },
    })
  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
