import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { verifyAuth } from '@/lib/auth'
import { computeWithdrawalInfo } from '@/lib/wallet-utils'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { rateLimit } from '@/lib/rate-limit'
import { getAddress } from 'viem'
import { z } from 'zod'

const withdrawPrincipalSchema = z.object({
  amount: z.string().refine(
    val => { const n = parseFloat(val); return !isNaN(n) && n > 0 && isFinite(n) && !/e/i.test(val) },
    'Amount must be a positive number without scientific notation'
  ),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format'),
  token: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = rateLimit(`withdraw-principal:${privyId}`, { limit: 5, windowSecs: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many withdrawal requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = withdrawPrincipalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const { amount, walletAddress: rawWalletAddress, token } = parsed.data

    const parsedAmountInr = parseFloat(amount)



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

    let walletAddress: string
    try {
      walletAddress = getAddress(rawWalletAddress)
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet address. Please verify the address and try again.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { profile: true },
    })

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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

    const amountInr = parsedAmountInr
    const cryptoAmount = parsedAmountInr / inrPrice
    // No platform fee for principal withdrawal
    const netAmountInr = amountInr
    const netCryptoAmount = cryptoAmount

    const result = await prisma.$transaction(async (tx) => {
      const info = await computeWithdrawalInfo(tx, user.id)

      // Only allow withdrawal up to the unlocked principal amount
      // (minus any principal already withdrawn)
      const principalAlreadyWithdrawn = Math.max(0, info.totalWithdrawn - info.roiBalance)
      const availablePrincipal = Math.max(0, info.unlockedPrincipal - Math.max(0, principalAlreadyWithdrawn))

      if (amountInr > availablePrincipal) {
        throw new Error('INSUFFICIENT_PRINCIPAL')
      }

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
            principalDeduction: amountInr,
            roiDeduction: 0,
            adminFeePercent: 0,
            feeAmountInr: 0,
            netAmountInr,
            netAmount: netCryptoAmount,
            isPrincipalWithdrawal: true,
          },
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
    if (error instanceof Error && error.message === 'INSUFFICIENT_PRINCIPAL') {
      return NextResponse.json(
        { error: 'Insufficient unlocked principal for this withdrawal' },
        { status: 400 }
      )
    }
    console.error('Principal withdrawal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
