import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { createPublicClient, http, formatEther, formatUnits, decodeEventLog, erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { getTokenPriceInINR } from '@/lib/crypto-price'

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

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: DepositRequest = await request.json()
    const { txHash, amount, walletAddress, token } = body

    // Validate required fields
    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }
    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }
    if (!token || !ALLOWED_TOKENS.includes(token)) {
      return NextResponse.json({ error: 'Invalid token. Must be ETH or USDT' }, { status: 400 })
    }

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

    // Check if transaction already exists
    const existingTx = await prisma.transaction.findFirst({
      where: { txHash: txHash.toLowerCase() },
    })

    if (existingTx) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 })
    }

    // Create pending transaction first
    const transaction = await prisma.transaction.create({
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

      // Referral commission rate (10% for direct referrer)
      const REFERRAL_COMMISSION_RATE = 0.10

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
            },
          },
        })

        const updatedProfile = await tx.profile.update({
          where: { userId: user.id },
          data: {
            availableBalance: {
              increment: amountInr,
            },
            totalBalance: {
              increment: amountInr,
            },
            totalInvested: {
              increment: amountInr,
            },
          },
        })

        // Pay referral commission to direct referrer
        const referral = await tx.referral.findFirst({
          where: { refereeId: user.id, level: 1 },
        })

        if (referral) {
          const commission = amountInr * REFERRAL_COMMISSION_RATE

          // Create referral transaction for the referrer
          await tx.transaction.create({
            data: {
              userId: referral.referrerId,
              type: 'referral',
              amount: commission,
              amountInr: commission,
              token: 'INR',
              status: 'completed',
              metadata: {
                fromUserId: user.id,
                fromAddress: walletAddress || 'Unknown',
                level: 1,
                depositAmount: amountInr,
                rate: `${REFERRAL_COMMISSION_RATE * 100}%`,
              },
            },
          })

          // Credit referrer's balance
          await tx.profile.update({
            where: { userId: referral.referrerId },
            data: {
              availableBalance: { increment: commission },
              totalBalance: { increment: commission },
            },
          })

          // Update referral total earnings
          await tx.referral.update({
            where: { id: referral.id },
            data: {
              totalEarnings: { increment: commission },
            },
          })
        }

        return { transaction: updatedTransaction, profile: updatedProfile }
      })

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
        message: `${token} deposit confirmed — ${cryptoAmount} ${token} = ₹${amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
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
