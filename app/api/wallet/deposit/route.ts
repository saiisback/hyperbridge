import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { createPublicClient, http, formatEther, formatUnits, decodeEventLog, erc20Abi } from 'viem'
import { mainnet, bsc } from 'viem/chains'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { getDepositLockDate, LOCK_DURATION_MONTHS } from '@/lib/wallet-utils'
import { payFirstDepositReferralCommissions } from '@/lib/referral-commission'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const PLATFORM_DEPOSIT_ADDRESS = (process.env.NEXT_PUBLIC_PLATFORM_DEPOSIT_ADDRESS || '').toLowerCase()
const BEP20_DEPOSIT_ADDRESS = (process.env.NEXT_PUBLIC_BEP20_DEPOSIT_ADDRESS || '0xef7063e1329331343fe88478421a2af15a725030').toLowerCase()

const ERC20_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDT: {
    address: (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '').toLowerCase(),
    decimals: 6,
  },
}

// BSC USDT (Binance-Peg) — 18 decimals
const BSC_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDT: {
    address: '0x55d398326f99059ff775485246999027b3197955',
    decimals: 18,
  },
}

const ethPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const bscPublicClient = createPublicClient({
  chain: bsc,
  transport: http(),
})

const depositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  amount: z.string().min(1, 'Amount is required'),
  walletAddress: z.string().optional(),
  token: z.enum(['ETH', 'USDT'], { message: 'Invalid token. Must be ETH or USDT' }),
  network: z.enum(['ethereum', 'bsc']).default('ethereum'),
})

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 deposit requests per 60 seconds per user
    const rl = rateLimit(`deposit:${privyId}`, { limit: 10, windowSecs: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many deposit requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = depositSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const { txHash, amount, walletAddress, token, network } = parsed.data
    const isBsc = network === 'bsc'
    const publicClient = isBsc ? bscPublicClient : ethPublicClient
    const depositAddress = isBsc ? BEP20_DEPOSIT_ADDRESS : PLATFORM_DEPOSIT_ADDRESS
    const tokenConfigs = isBsc ? BSC_TOKENS : ERC20_TOKENS

    // Find user by verified privyId
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

    // Create pending transaction — unique constraint on txHash prevents duplicates atomically
    let transaction
    try {
      transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: parseFloat(amount),
          token,
          status: 'pending',
          txHash: txHash.toLowerCase(),
          walletAddress: walletAddress?.toLowerCase() || null,
          metadata: {
            network,
            platformAddress: depositAddress,
          },
        },
      })
    } catch (err: any) {
      // P2002 = unique constraint violation (duplicate txHash)
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 })
      }
      throw err
    }

    // Verify transaction on-chain
    try {
      let txReceipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      })

      // Fallback: if receipt is not yet available, wait briefly
      if (!txReceipt) {
        txReceipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
          confirmations: 1,
          timeout: 60_000,
        })
      }

      // Verify the transaction was successful
      if (txReceipt.status !== 'success') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json({ error: 'Transaction failed on chain' }, { status: 400 })
      }

      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      })

      // Phase 3: Verify tx.from matches one of the authenticated user's wallet addresses
      const userWallets = await prisma.userWallet.findMany({ where: { userId: user.id } })
      const userAddresses = userWallets.map(w => w.walletAddress.toLowerCase())
      if (!userAddresses.includes(tx.from.toLowerCase())) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json(
          { error: 'Transaction sender does not match your registered wallets' },
          { status: 400 }
        )
      }

      let actualAmount: string | null = null

      if (token === 'ETH' && !isBsc) {
        // Native ETH transfer — verify recipient is platform address
        if (tx.to?.toLowerCase() !== depositAddress) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
        }
        actualAmount = formatEther(tx.value)
      } else {
        // ERC-20 / BEP-20 token transfer — verify via Transfer event logs
        const tokenConfig = tokenConfigs[token]

        if (tx.to?.toLowerCase() !== tokenConfig.address) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'Transaction was not sent to the expected token contract' }, { status: 400 })
        }

        for (const log of txReceipt.logs) {
          if (log.address.toLowerCase() !== tokenConfig.address) continue

          try {
            const decoded = decodeEventLog({
              abi: erc20Abi,
              data: log.data,
              topics: log.topics,
            })

            if (
              decoded.eventName === 'Transfer' &&
              decoded.args.to.toLowerCase() === depositAddress
            ) {
              actualAmount = formatUnits(decoded.args.value, tokenConfig.decimals)
              break
            }
          } catch {
            continue
          }
        }

        if (!actualAmount) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'No valid token transfer to platform address found' }, { status: 400 })
        }
      }

      // Fetch real-time INR conversion rate
      let inrPrice: number
      let priceFetchedAt: string
      try {
        const priceData = await getTokenPriceInINR(token)
        inrPrice = priceData.inrPrice
        priceFetchedAt = priceData.fetchedAt
      } catch (priceError) {
        console.error('Failed to fetch INR price:', priceError)
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json(
          { error: 'Failed to fetch real-time INR conversion rate. Please try again.' },
          { status: 500 }
        )
      }

      const cryptoAmount = parseFloat(actualAmount!)
      const amountInr = cryptoAmount * inrPrice

      // Update transaction and profile balance
      const result = await prisma.$transaction(async (tx) => {
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'completed',
            amount: cryptoAmount,
            amountInr,
            conversionRate: inrPrice,
            metadata: {
              network,
              platformAddress: depositAddress,
              priceFetchedAt,
              lockedUntil: getDepositLockDate().toISOString(),
            },
          },
        })

        const updatedProfile = await tx.profile.update({
          where: { userId: user.id },
          data: {
            totalBalance: {
              increment: amountInr,
            },
            totalInvested: {
              increment: amountInr,
            },
          },
        })

        await payFirstDepositReferralCommissions(tx, user.id, amountInr, transaction.id)

        return { transaction: updatedTransaction, profile: updatedProfile }
      })

      const lockedUntil = getDepositLockDate()
      return NextResponse.json({
        success: true,
        transaction: result.transaction,
        profile: result.profile,
        conversion: {
          cryptoAmount,
          token,
          inrRate: inrPrice,
          amountInr,
          convertedAt: priceFetchedAt,
        },
        lockInfo: {
          lockedUntil: lockedUntil.toISOString(),
          lockDurationMonths: LOCK_DURATION_MONTHS,
        },
        message: `${token} deposit confirmed — ${cryptoAmount} ${token} = ₹${amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Principal locked until ${lockedUntil.toLocaleDateString()}.`,
      })
    } catch (verifyError) {
      console.error('Transaction verification error:', verifyError)

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed' },
      })

      return NextResponse.json(
        { error: 'Failed to verify transaction on chain' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
