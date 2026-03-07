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

// 5-minute window: tx must have been submitted within the last 5 minutes
const TX_SUBMISSION_WINDOW_MS = 5 * 60 * 1000
// Allow 2% tolerance for amount mismatch (gas deduction on native transfers, rounding)
const AMOUNT_TOLERANCE = 0.02

const depositManualSchema = z.object({
  txHash: z.string().min(10, 'Please enter a valid transaction hash'),
  amount: z.string().min(1, 'Amount is required'),
  senderAddress: z.string().optional(), // required for ethereum/bsc, optional for trc20
  network: z.enum(['ethereum', 'bsc', 'trc20'], { message: 'Invalid network' }),
  token: z.enum(['ETH', 'USDT']).default('USDT'),
  submittedAt: z.number().optional(), // timestamp when user started the deposit flow
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

    const { txHash, amount, network, token, senderAddress, submittedAt } = parsed.data
    const networkLabel = NETWORK_LABELS[network]

    // For EVM chains, require sender address
    if ((network === 'ethereum' || network === 'bsc') && !senderAddress?.trim()) {
      return NextResponse.json(
        { error: 'Sender wallet address is required' },
        { status: 400 }
      )
    }

    // Enforce 5-minute submission window
    if (submittedAt) {
      const elapsed = Date.now() - submittedAt
      if (elapsed > TX_SUBMISSION_WINDOW_MS) {
        return NextResponse.json(
          { error: 'Submission window expired. Please start a new deposit.' },
          { status: 400 }
        )
      }
    }

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
          walletAddress: senderAddress?.trim().toLowerCase() || null,
          metadata: {
            network,
            networkLabel,
            method: 'manual',
            senderAddress: senderAddress?.trim().toLowerCase() || null,
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

        // Verify sender address matches what the user provided
        if (senderAddress && tx.from.toLowerCase() !== senderAddress.trim().toLowerCase()) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json(
            { error: 'Transaction sender does not match the wallet address you provided' },
            { status: 400 }
          )
        }

        // Verify the tx was mined within the 5-minute window
        const block = await publicClient.getBlock({ blockNumber: txReceipt.blockNumber })
        const txTimestamp = Number(block.timestamp) * 1000 // convert to ms
        const now = Date.now()
        if (now - txTimestamp > TX_SUBMISSION_WINDOW_MS) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          })
          return NextResponse.json(
            { error: 'Transaction is older than 5 minutes. Please start a new deposit.' },
            { status: 400 }
          )
        }

        let actualAmount: string | null = null
        let verifiedTokenContract: string | null = null
        let verifiedFrom: string | null = null
        let verifiedTo: string | null = null

        if (token === 'ETH' && !isBsc) {
          // Native ETH transfer — verify recipient is platform address
          if (tx.to?.toLowerCase() !== depositAddress) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json(
              { error: `ETH was not sent to the platform address. Expected ${depositAddress}, got ${tx.to?.toLowerCase()}` },
              { status: 400 }
            )
          }
          actualAmount = formatEther(tx.value)
          verifiedFrom = tx.from.toLowerCase()
          verifiedTo = tx.to.toLowerCase()
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

          // Verify the transaction interacted with the exact whitelisted token contract
          if (tx.to?.toLowerCase() !== tokenConfig.address) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json(
              { error: `Wrong token contract. Expected ${token} contract (${tokenConfig.address}), but transaction was sent to ${tx.to?.toLowerCase()}. Make sure you sent the correct token.` },
              { status: 400 }
            )
          }

          // Parse Transfer events only from the whitelisted token contract
          for (const log of txReceipt.logs) {
            // Only look at events emitted by the exact expected token contract
            if (log.address.toLowerCase() !== tokenConfig.address) continue

            try {
              const decoded = decodeEventLog({
                abi: erc20Abi,
                data: log.data,
                topics: log.topics,
              })

              if (decoded.eventName !== 'Transfer') continue

              const eventFrom = decoded.args.from.toLowerCase()
              const eventTo = decoded.args.to.toLowerCase()

              // Must be sent TO the platform deposit address
              if (eventTo !== depositAddress) continue

              // Must be sent FROM the sender address the user provided
              if (senderAddress && eventFrom !== senderAddress.trim().toLowerCase()) continue

              actualAmount = formatUnits(decoded.args.value, tokenConfig.decimals)
              verifiedTokenContract = log.address.toLowerCase()
              verifiedFrom = eventFrom
              verifiedTo = eventTo
              break
            } catch {
              continue
            }
          }

          if (!actualAmount) {
            // Determine why verification failed for a helpful error
            let reason = 'No valid token transfer found.'

            // Check if there's a Transfer to the right address but from wrong sender
            for (const log of txReceipt.logs) {
              if (log.address.toLowerCase() !== tokenConfig.address) continue
              try {
                const decoded = decodeEventLog({
                  abi: erc20Abi,
                  data: log.data,
                  topics: log.topics,
                })
                if (decoded.eventName === 'Transfer') {
                  const eventTo = decoded.args.to.toLowerCase()
                  const eventFrom = decoded.args.from.toLowerCase()
                  if (eventTo === depositAddress && senderAddress && eventFrom !== senderAddress.trim().toLowerCase()) {
                    reason = `Transfer found but sender doesn't match. On-chain sender: ${eventFrom}, you provided: ${senderAddress.trim().toLowerCase()}`
                  } else if (eventTo !== depositAddress) {
                    reason = `Tokens were sent to ${eventTo}, not the platform address ${depositAddress}.`
                  }
                }
              } catch {
                continue
              }
            }

            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json({ error: reason }, { status: 400 })
          }
        }

        // Verify the on-chain amount matches what the user claimed (with gas tolerance)
        const claimedAmount = parseFloat(amount)
        const onChainAmount = parseFloat(actualAmount!)
        if (claimedAmount > 0 && onChainAmount > 0) {
          const diff = Math.abs(onChainAmount - claimedAmount)
          const tolerance = claimedAmount * AMOUNT_TOLERANCE
          if (diff > tolerance) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json(
              { error: `Amount mismatch. You claimed ${claimedAmount} ${token} but the transaction shows ${onChainAmount} ${token}.` },
              { status: 400 }
            )
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
                verifiedOnChain: true,
                verifiedTokenContract,
                verifiedFrom,
                verifiedTo,
                claimedAmount: parseFloat(amount),
                onChainAmount: cryptoAmount,
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
