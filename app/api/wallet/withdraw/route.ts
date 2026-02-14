import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { computeWithdrawalInfo } from '@/lib/wallet-utils'
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

    // Amount from client is in INR
    const parsedAmountInr = parseFloat(amount)
    if (isNaN(parsedAmountInr) || parsedAmountInr <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Check withdrawal window
    const withdrawalWindow = await prisma.withdrawalWindow.findUnique({
      where: { id: 'default' },
    })

    if (withdrawalWindow?.opensAt || withdrawalWindow?.closesAt) {
      const now = new Date()
      let isOpen = true
      if (withdrawalWindow.opensAt && withdrawalWindow.closesAt) {
        isOpen = now >= withdrawalWindow.opensAt && now <= withdrawalWindow.closesAt
      } else if (withdrawalWindow.opensAt) {
        isOpen = now >= withdrawalWindow.opensAt
      } else if (withdrawalWindow.closesAt) {
        isOpen = now <= withdrawalWindow.closesAt
      }

      if (!isOpen) {
        return NextResponse.json(
          { error: 'Withdrawals are currently closed. Please try again during the withdrawal window.' },
          { status: 400 }
        )
      }
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

    // Input is already in INR
    const amountInr = parsedAmountInr
    // Convert INR to crypto for on-chain transfer
    const cryptoAmount = parsedAmountInr / inrPrice

    // 10% admin/platform fee (applied on INR amount)
    const ADMIN_FEE_PERCENT = 10
    const feeAmountInr = amountInr * (ADMIN_FEE_PERCENT / 100)
    const netAmountInr = amountInr - feeAmountInr
    // Net crypto amount to send on-chain (after 10% fee)
    const netCryptoAmount = netAmountInr / inrPrice

    // Minimum withdrawal check
    if (amountInr < MIN_WITHDRAWAL_INR) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR}` },
        { status: 400 }
      )
    }

    // Atomic transaction: compute available withdrawal inside transaction to prevent race condition
    const result = await prisma.$transaction(async (tx) => {
      const info = await computeWithdrawalInfo(tx, user.id)
      const withdrawAmountInr = new Prisma.Decimal(amountInr.toString())

      if (withdrawAmountInr.greaterThan(new Prisma.Decimal(info.availableWithdrawal.toString()))) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

      // Deduct from roiBalance first, then unlocked principal
      const roiDeduction = Math.min(info.roiBalance, amountInr)
      const principalDeduction = amountInr - roiDeduction

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdraw',
          amount: cryptoAmount,
          amountInr,
          conversionRate: inrPrice,
          token: selectedToken,
          status: 'pending',
          walletAddress,
          metadata: {
            requestedAt: new Date().toISOString(),
            priceFetchedAt,
            roiDeduction,
            principalDeduction,
            adminFeePercent: ADMIN_FEE_PERCENT,
            feeAmountInr,
            netAmountInr,
            netAmount: netCryptoAmount,
          },
        },
      })

      await tx.profile.update({
        where: { userId: user.id },
        data: {
          roiBalance: { decrement: roiDeduction },
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
        amountInr: result.amountInr?.toString(),
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
