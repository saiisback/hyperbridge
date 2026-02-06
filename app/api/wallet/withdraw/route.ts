import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface WithdrawRequest {
  privyId: string
  amount: string
  walletAddress: string
}

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json()
    const { privyId, amount, walletAddress } = body

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

    // Atomic transaction: create withdrawal record + deduct balance
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdraw',
          amount: withdrawAmount,
          status: 'pending',
          walletAddress,
          metadata: { requestedAt: new Date().toISOString() },
        },
      })

      await tx.profile.update({
        where: { userId: user.id },
        data: {
          availableBalance: { decrement: withdrawAmount },
          totalBalance: { decrement: withdrawAmount },
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
