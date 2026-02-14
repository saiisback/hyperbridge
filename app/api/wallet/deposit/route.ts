import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { createPublicClient, http, formatEther, formatUnits, decodeEventLog, erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { getDepositLockDate, LOCK_DURATION_MONTHS } from '@/lib/wallet-utils'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Platform deposit address on Sepolia
const PLATFORM_DEPOSIT_ADDRESS = '0x531dB6ca6baE892b191f7F9122beA32F228fbee1'.toLowerCase()

// Allowed tokens on Sepolia (only USDT enabled)
const ERC20_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDT: {
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'.toLowerCase(),
    decimals: 6,
  },
}

const ALLOWED_TOKENS = ['ETH', 'USDT']

// Create a public client for Sepolia to verify transactions
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

interface DepositRequest {
  txHash: string
  amount: string
  walletAddress: string
  token: string
}

const depositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  amount: z.string().min(1, 'Amount is required'),
  walletAddress: z.string().optional(),
  token: z.enum(['ETH', 'USDT'], { message: 'Invalid token. Must be ETH or USDT' }),
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
    const { txHash, amount, walletAddress, token } = parsed.data

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
            network: 'sepolia',
            platformAddress: PLATFORM_DEPOSIT_ADDRESS,
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

    // Verify transaction on Sepolia
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

      if (token === 'ETH') {
        // Native ETH transfer — verify recipient is platform address
        if (tx.to?.toLowerCase() !== PLATFORM_DEPOSIT_ADDRESS) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
        }
        actualAmount = formatEther(tx.value)
      } else {
        // ERC-20 transfer (USDT) — verify via Transfer event logs
        const tokenConfig = ERC20_TOKENS[token]

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
              decoded.args.to.toLowerCase() === PLATFORM_DEPOSIT_ADDRESS
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

      // Referral commission rates
      const L1_RATE = 0.03 // 3% for direct referrer
      const L2_RATE = 0.01 // 1% for indirect referrer

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
              network: 'sepolia',
              platformAddress: PLATFORM_DEPOSIT_ADDRESS,
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

        // Only pay instant referral commission on first deposit
        const previousDeposit = await tx.transaction.findFirst({
          where: {
            userId: user.id,
            type: 'deposit',
            status: 'completed',
            id: { not: transaction.id },
          },
        })

        const isFirstDeposit = !previousDeposit

        if (isFirstDeposit) {
          // Pay L1 referral commission to direct referrer
          const l1Referral = await tx.referral.findFirst({
            where: { refereeId: user.id, level: 1 },
          })

          if (l1Referral) {
            const l1Commission = amountInr * L1_RATE

            await tx.transaction.create({
              data: {
                userId: l1Referral.referrerId,
                type: 'referral',
                amount: l1Commission,
                amountInr: l1Commission,
                token: 'INR',
                status: 'completed',
                metadata: {
                  fromUserId: user.id,
                  fromAddress: walletAddress || 'Unknown',
                  level: 1,
                  depositAmount: amountInr,
                  rate: `${L1_RATE * 100}%`,
                  type: 'instant',
                },
              },
            })

            await tx.profile.update({
              where: { userId: l1Referral.referrerId },
              data: {
                availableBalance: { increment: l1Commission },
                roiBalance: { increment: l1Commission },
                totalBalance: { increment: l1Commission },
              },
            })

            await tx.referral.update({
              where: { id: l1Referral.id },
              data: {
                totalEarnings: { increment: l1Commission },
              },
            })
          }

          // Pay L2 referral commission to indirect referrer
          const l2Referral = await tx.referral.findFirst({
            where: { refereeId: user.id, level: 2 },
          })

          if (l2Referral) {
            const l2Commission = amountInr * L2_RATE

            await tx.transaction.create({
              data: {
                userId: l2Referral.referrerId,
                type: 'referral',
                amount: l2Commission,
                amountInr: l2Commission,
                token: 'INR',
                status: 'completed',
                metadata: {
                  fromUserId: user.id,
                  fromAddress: walletAddress || 'Unknown',
                  level: 2,
                  depositAmount: amountInr,
                  rate: `${L2_RATE * 100}%`,
                  type: 'instant',
                },
              },
            })

            await tx.profile.update({
              where: { userId: l2Referral.referrerId },
              data: {
                availableBalance: { increment: l2Commission },
                roiBalance: { increment: l2Commission },
                totalBalance: { increment: l2Commission },
              },
            })

            await tx.referral.update({
              where: { id: l2Referral.id },
              data: {
                totalEarnings: { increment: l2Commission },
              },
            })
          }
        }

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
