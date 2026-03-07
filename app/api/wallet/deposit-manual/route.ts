import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { createPublicClient, http, formatEther, formatUnits, decodeEventLog, erc20Abi } from 'viem'
import { mainnet, bsc } from 'viem/chains'
import { getTokenPriceInINR } from '@/lib/crypto-price'
import { getDepositLockDate, LOCK_DURATION_MONTHS } from '@/lib/wallet-utils'
import { payFirstDepositReferralCommissions } from '@/lib/referral-commission'

const PLATFORM_DEPOSIT_ADDRESS = (process.env.NEXT_PUBLIC_PLATFORM_DEPOSIT_ADDRESS || '').toLowerCase()
const BEP20_DEPOSIT_ADDRESS = (process.env.NEXT_PUBLIC_BEP20_DEPOSIT_ADDRESS || '0xef7063e1329331343fe88478421a2af15a725030').toLowerCase()

const ERC20_TOKENS: Record<string, { address: string; decimals: number }> = {
  USDT: {
    address: (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '').toLowerCase(),
    decimals: 6,
  },
}

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
  transport: http(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org'),
})

const depositManualSchema = z.object({
  txHash: z.string().min(10, 'Please enter a valid transaction hash'),
  amount: z.string().min(1, 'Amount is required'),
  network: z.enum(['ethereum', 'bsc', 'trc20'], { message: 'Invalid network' }),
  token: z.enum(['ETH', 'USDT']).default('USDT'),
})

const DEPOSIT_ADDRESSES: Record<string, string> = {
  ethereum: PLATFORM_DEPOSIT_ADDRESS,
  bsc: BEP20_DEPOSIT_ADDRESS,
  trc20: process.env.NEXT_PUBLIC_TRC20_DEPOSIT_ADDRESS || 'TZA7cFmFFtTsKrVkLqdSPSHpZzD8if189t',
}

const NETWORK_LABELS: Record<string, string> = {
  ethereum: 'ERC-20 (Ethereum)',
  bsc: 'BEP-20 (BSC)',
  trc20: 'TRC-20 (Tron)',
}

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = rateLimit(`deposit-manual:${privyId}`, { limit: 10, windowSecs: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = depositManualSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { txHash, amount, network, token } = parsed.data
    const networkLabel = NETWORK_LABELS[network]

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

    // Create pending transaction — unique constraint on txHash prevents duplicates
    let transaction
    try {
      transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: parseFloat(amount),
          token,
          status: 'pending',
          txHash: txHash.trim(),
          metadata: {
            network,
            networkLabel,
            method: 'manual',
            platformAddress: DEPOSIT_ADDRESSES[network],
          },
        },
      })
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Transaction already submitted' }, { status: 400 })
      }
      throw err
    }

    // For ERC-20 / BEP-20: verify on-chain automatically
    if (network === 'ethereum' || network === 'bsc') {
      const isBsc = network === 'bsc'
      const publicClient = isBsc ? bscPublicClient : ethPublicClient
      const depositAddress = DEPOSIT_ADDRESSES[network]
      const tokenConfigs = isBsc ? BSC_TOKENS : ERC20_TOKENS

      try {
        // Validate tx hash format for EVM chains
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 })
        }

        const hash = txHash.trim() as `0x${string}`

        let txReceipt = await publicClient.getTransactionReceipt({ hash })

        if (!txReceipt) {
          txReceipt = await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
            timeout: 60_000,
          })
        }

        if (txReceipt.status !== 'success') {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json({ error: 'Transaction failed on chain' }, { status: 400 })
        }

        const tx = await publicClient.getTransaction({ hash })

        let actualAmount: string | null = null

        if (token === 'ETH' && !isBsc) {
          // Native ETH transfer
          if (tx.to?.toLowerCase() !== depositAddress) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
          }
          actualAmount = formatEther(tx.value)
        } else {
          // ERC-20 / BEP-20 token transfer
          const tokenConfig = tokenConfigs[token]

          if (!tokenConfig) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json({ error: 'Unsupported token for this network' }, { status: 400 })
          }

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

        // Fetch INR conversion rate
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

        // Update transaction and credit balance
        const result = await prisma.$transaction(async (prismaTransaction) => {
          const updatedTransaction = await prismaTransaction.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'completed',
              amount: cryptoAmount,
              amountInr,
              conversionRate: inrPrice,
              walletAddress: tx.from.toLowerCase(),
              metadata: {
                network,
                networkLabel,
                method: 'manual',
                platformAddress: depositAddress,
                priceFetchedAt,
                lockedUntil: getDepositLockDate().toISOString(),
              },
            },
          })

          const updatedProfile = await prismaTransaction.profile.update({
            where: { userId: user.id },
            data: {
              totalBalance: { increment: amountInr },
              totalInvested: { increment: amountInr },
            },
          })

          await payFirstDepositReferralCommissions(prismaTransaction, user.id, amountInr, transaction.id)

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
        console.error('On-chain verification error:', verifyError)
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json(
          { error: 'Failed to verify transaction on chain. Please check the hash and try again.' },
          { status: 400 }
        )
      }
    }

    // TRC-20: pending admin verification
    return NextResponse.json({
      success: true,
      transaction,
      message: `Deposit of ${amount} USDT via ${networkLabel} submitted. It will be credited after admin verification.`,
    })
  } catch (error) {
    console.error('Manual deposit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
