import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { getTokenPriceInINR } from '@/lib/crypto-price'

// Minimum withdrawal amount in INR
const MIN_WITHDRAWAL_INR = 100

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, walletAddress, token } = body

    if (!amount || !walletAddress) {
      return NextResponse.json(
        { error: 'amount and walletAddress are required' },
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

    const amountInr = parsedAmount * inrPrice

    // Minimum withdrawal check
    if (amountInr < MIN_WITHDRAWAL_INR) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR}` },
        { status: 400 }
      )
    }

    // Atomic transaction: re-read balance inside transaction to prevent race condition
    const result = await prisma.$transaction(async (tx) => {
      // Re-read balance inside transaction for consistency
      const freshProfile = await tx.profile.findUniqueOrThrow({ where: { userId: user.id } })
      const availableBalance = new Prisma.Decimal(freshProfile.availableBalance.toString())
      const withdrawAmountInr = new Prisma.Decimal(amountInr.toString())

      if (availableBalance.lessThan(withdrawAmountInr)) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdraw',
          amount: parsedAmount,
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
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }
    console.error('Withdrawal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
