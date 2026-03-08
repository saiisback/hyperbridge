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
      console.warn(`[deposit-manual] Rate limited user=${privyId}`)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = depositManualSchema.safeParse(body)
    if (!parsed.success) {
      console.warn(`[deposit-manual] Validation failed user=${privyId}:`, parsed.error.issues)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { txHash, amount, network, token, senderAddress, submittedAt } = parsed.data
    const networkLabel = NETWORK_LABELS[network]

    console.log(`[deposit-manual] START user=${privyId} network=${network} token=${token} amount=${amount} txHash=${txHash} sender=${senderAddress || 'none'}`)

    // For EVM chains, require sender address
    if ((network === 'ethereum' || network === 'bsc') && !senderAddress?.trim()) {
      console.warn(`[deposit-manual] REJECTED: Missing sender address user=${privyId} txHash=${txHash}`)
      return NextResponse.json(
        { error: 'Sender wallet address is required' },
        { status: 400 }
      )
    }

    // Enforce 5-minute submission window
    if (submittedAt) {
      const elapsed = Date.now() - submittedAt
      console.log(`[deposit-manual] Submission window check: elapsed=${Math.round(elapsed / 1000)}s, limit=${TX_SUBMISSION_WINDOW_MS / 1000}s user=${privyId} txHash=${txHash}`)
      if (elapsed > TX_SUBMISSION_WINDOW_MS) {
        console.warn(`[deposit-manual] REJECTED: Submission window expired (${Math.round(elapsed / 1000)}s) user=${privyId} txHash=${txHash}`)
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
      console.warn(`[deposit-manual] REJECTED: User not found privyId=${privyId}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.profile) {
      console.warn(`[deposit-manual] REJECTED: Profile not found user=${user.id} privyId=${privyId}`)
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // For EVM chains, validate tx hash format early (before creating DB record)
    if ((network === 'ethereum' || network === 'bsc') && !/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      console.warn(`[deposit-manual] REJECTED: Invalid tx hash format user=${user.id} txHash=${txHash}`)
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 })
    }

    // Check if this tx hash already exists with a completed/pending status
    const existing = await prisma.transaction.findUnique({
      where: { txHash: txHash.trim() },
    })
    if (existing) {
      console.log(`[deposit-manual] Existing transaction found: id=${existing.id} status=${existing.status} createdAt=${existing.createdAt} user=${user.id} txHash=${txHash}`)
    }
    if (existing && existing.status === 'completed') {
      console.warn(`[deposit-manual] REJECTED: Already completed txId=${existing.id} user=${user.id} txHash=${txHash}`)
      return NextResponse.json(
        { error: 'Transaction already processed' },
        { status: 400 }
      )
    }
    // If pending but older than 3 minutes, it's a stale record from a timed-out request — allow retry
    if (existing && existing.status === 'pending') {
      const ageMs = Date.now() - new Date(existing.createdAt).getTime()
      console.log(`[deposit-manual] Pending transaction age=${Math.round(ageMs / 1000)}s txId=${existing.id} user=${user.id} txHash=${txHash}`)
      if (ageMs < 3 * 60 * 1000) {
        console.warn(`[deposit-manual] REJECTED: Still processing (${Math.round(ageMs / 1000)}s old) txId=${existing.id} user=${user.id} txHash=${txHash}`)
        return NextResponse.json(
          { error: 'Transaction is already being processed. Please wait a moment and try again.' },
          { status: 400 }
        )
      }
      // Stale pending — delete to allow retry
      console.warn(`[deposit-manual] Deleting stale pending transaction (${Math.round(ageMs / 1000)}s old) txId=${existing.id} user=${user.id} txHash=${txHash}`)
      await prisma.transaction.delete({ where: { id: existing.id } })
    }
    // If a previous failed attempt exists, delete it to allow retry
    if (existing && existing.status === 'failed') {
      console.log(`[deposit-manual] Deleting previous failed attempt txId=${existing.id} user=${user.id} txHash=${txHash}`)
      await prisma.transaction.delete({ where: { id: existing.id } })
    }

    // Create pending transaction
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
      console.log(`[deposit-manual] Created pending transaction txId=${transaction.id} user=${user.id} txHash=${txHash}`)
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        console.warn(`[deposit-manual] REJECTED: Unique constraint violation (race condition) user=${user.id} txHash=${txHash}`)
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

      console.log(`[deposit-manual] Starting on-chain verification: network=${network} depositAddress=${depositAddress} txId=${transaction.id} txHash=${txHash}`)

      try {
        const hash = txHash.trim() as `0x${string}`

        let txReceipt
        try {
          console.log(`[deposit-manual] Fetching receipt... txHash=${txHash}`)
          txReceipt = await publicClient.getTransactionReceipt({ hash })
          console.log(`[deposit-manual] Receipt found immediately: status=${txReceipt.status} blockNumber=${txReceipt.blockNumber} txHash=${txHash}`)
        } catch (receiptErr) {
          console.warn(`[deposit-manual] Receipt not available yet, will wait: txHash=${txHash}`, receiptErr instanceof Error ? receiptErr.message : receiptErr)
        }

        if (!txReceipt) {
          try {
            console.log(`[deposit-manual] Waiting for receipt (120s timeout)... txHash=${txHash}`)
            const waitStart = Date.now()
            txReceipt = await publicClient.waitForTransactionReceipt({
              hash,
              confirmations: 1,
              timeout: 120_000,
            })
            console.log(`[deposit-manual] Receipt received after ${Math.round((Date.now() - waitStart) / 1000)}s: status=${txReceipt.status} blockNumber=${txReceipt.blockNumber} txHash=${txHash}`)
          } catch (waitErr) {
            console.error(`[deposit-manual] FAILED: Receipt wait timed out or errored txId=${transaction.id} txHash=${txHash}`, waitErr instanceof Error ? waitErr.message : waitErr)
            await prisma.transaction.delete({
              where: { id: transaction.id },
            })
            return NextResponse.json(
              { error: 'Transaction not found on chain. It may still be pending — please wait and try again.' },
              { status: 400 }
            )
          }
        }

        if (txReceipt.status !== 'success') {
          console.warn(`[deposit-manual] REJECTED: Transaction reverted on-chain status=${txReceipt.status} txId=${transaction.id} txHash=${txHash}`)
          await prisma.transaction.delete({
            where: { id: transaction.id },
          })
          return NextResponse.json({ error: 'Transaction failed on chain' }, { status: 400 })
        }

        const tx = await publicClient.getTransaction({ hash })
        console.log(`[deposit-manual] Transaction details: from=${tx.from} to=${tx.to} value=${tx.value} txHash=${txHash}`)

        // Detect Account Abstraction (ERC-4337) transactions
        // AA txs go through an Entry Point contract, so tx.from is the bundler, not the user
        const ERC4337_ENTRY_POINTS = [
          '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789', // v0.6
          '0x0000000071727de22e5e9d8baf0edac6f37da032', // v0.7
        ]
        const isAccountAbstraction = ERC4337_ENTRY_POINTS.includes(tx.to?.toLowerCase() || '')
        if (isAccountAbstraction) {
          console.log(`[deposit-manual] ERC-4337 Account Abstraction detected: entryPoint=${tx.to?.toLowerCase()} bundler=${tx.from.toLowerCase()} — sender check will use Transfer events instead txHash=${txHash}`)
        }

        // Verify sender address matches what the user provided (skip for AA — verified via Transfer events below)
        if (!isAccountAbstraction && senderAddress && tx.from.toLowerCase() !== senderAddress.trim().toLowerCase()) {
          console.warn(`[deposit-manual] REJECTED: Sender mismatch — on-chain=${tx.from.toLowerCase()} provided=${senderAddress.trim().toLowerCase()} txId=${transaction.id} txHash=${txHash}`)
          await prisma.transaction.delete({
            where: { id: transaction.id },
          })
          return NextResponse.json(
            { error: 'Transaction sender does not match the wallet address you provided' },
            { status: 400 }
          )
        }

        // Verify the tx was mined within a reasonable window (10 minutes to account for network delays)
        const block = await publicClient.getBlock({ blockNumber: txReceipt.blockNumber })
        const txTimestamp = Number(block.timestamp) * 1000 // convert to ms
        const now = Date.now()
        const txAgeMs = now - txTimestamp
        const TX_ONCHAIN_WINDOW_MS = 10 * 60 * 1000 // 10 minutes — more lenient than client-side 5-min timer
        console.log(`[deposit-manual] Block timestamp check: blockTime=${new Date(txTimestamp).toISOString()} age=${Math.round(txAgeMs / 1000)}s limit=${TX_ONCHAIN_WINDOW_MS / 1000}s txHash=${txHash}`)
        if (txAgeMs > TX_ONCHAIN_WINDOW_MS) {
          console.warn(`[deposit-manual] REJECTED: Transaction too old (${Math.round(txAgeMs / 1000)}s) txId=${transaction.id} txHash=${txHash}`)
          await prisma.transaction.delete({
            where: { id: transaction.id },
          })
          return NextResponse.json(
            { error: 'Transaction is too old. Please start a new deposit.' },
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
            console.warn(`[deposit-manual] REJECTED: ETH recipient mismatch — expected=${depositAddress} got=${tx.to?.toLowerCase()} txId=${transaction.id} txHash=${txHash}`)
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
          console.log(`[deposit-manual] Native ETH transfer verified: amount=${actualAmount} from=${verifiedFrom} to=${verifiedTo} txHash=${txHash}`)
        } else {
          // ERC-20 / BEP-20 token transfer
          const tokenConfig = tokenConfigs[token]

          if (!tokenConfig) {
            console.warn(`[deposit-manual] REJECTED: Unsupported token=${token} for network=${network} txId=${transaction.id} txHash=${txHash}`)
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            })
            return NextResponse.json({ error: 'Unsupported token for this network' }, { status: 400 })
          }

          console.log(`[deposit-manual] Verifying token transfer: expectedContract=${tokenConfig.address} txTo=${tx.to?.toLowerCase()} isAA=${isAccountAbstraction} logs=${txReceipt.logs.length} txHash=${txHash}`)

          // Verify the transaction interacted with the exact whitelisted token contract
          // For AA (ERC-4337) txs, tx.to is the Entry Point — skip this check and rely on Transfer event logs
          if (!isAccountAbstraction && tx.to?.toLowerCase() !== tokenConfig.address) {
            console.warn(`[deposit-manual] REJECTED: Wrong token contract — expected=${tokenConfig.address} got=${tx.to?.toLowerCase()} txId=${transaction.id} txHash=${txHash}`)
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
            if (log.address.toLowerCase() !== tokenConfig.address) {
              console.log(`[deposit-manual] Skipping log from non-matching contract: ${log.address.toLowerCase()} txHash=${txHash}`)
              continue
            }

            try {
              const decoded = decodeEventLog({
                abi: erc20Abi,
                data: log.data,
                topics: log.topics,
              })

              if (decoded.eventName !== 'Transfer') {
                console.log(`[deposit-manual] Skipping non-Transfer event: ${decoded.eventName} txHash=${txHash}`)
                continue
              }

              const eventFrom = decoded.args.from.toLowerCase()
              const eventTo = decoded.args.to.toLowerCase()
              const eventValue = formatUnits(decoded.args.value, tokenConfig.decimals)
              console.log(`[deposit-manual] Transfer event: from=${eventFrom} to=${eventTo} value=${eventValue} txHash=${txHash}`)

              // Must be sent TO the platform deposit address
              if (eventTo !== depositAddress) {
                console.log(`[deposit-manual] Transfer recipient mismatch: got=${eventTo} expected=${depositAddress} — skipping txHash=${txHash}`)
                continue
              }

              // Must be sent FROM the sender address the user provided
              if (senderAddress && eventFrom !== senderAddress.trim().toLowerCase()) {
                console.log(`[deposit-manual] Transfer sender mismatch: got=${eventFrom} expected=${senderAddress.trim().toLowerCase()} — skipping txHash=${txHash}`)
                continue
              }

              actualAmount = eventValue
              verifiedTokenContract = log.address.toLowerCase()
              verifiedFrom = eventFrom
              verifiedTo = eventTo
              console.log(`[deposit-manual] Transfer MATCHED: amount=${actualAmount} from=${verifiedFrom} to=${verifiedTo} contract=${verifiedTokenContract} txHash=${txHash}`)
              break
            } catch (decodeErr) {
              console.warn(`[deposit-manual] Failed to decode log: txHash=${txHash}`, decodeErr instanceof Error ? decodeErr.message : decodeErr)
              continue
            }
          }

          if (!actualAmount) {
            // Determine why verification failed for a helpful error
            let reason = 'No valid token transfer found.'

            console.warn(`[deposit-manual] No matching transfer found. Analyzing ${txReceipt.logs.length} logs for diagnostics... txHash=${txHash}`)

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
                  const eventValue = formatUnits(decoded.args.value, tokenConfig.decimals)
                  console.warn(`[deposit-manual] Diagnostic Transfer: from=${eventFrom} to=${eventTo} value=${eventValue} depositAddr=${depositAddress} senderAddr=${senderAddress?.trim().toLowerCase()} txHash=${txHash}`)
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

            console.warn(`[deposit-manual] REJECTED: ${reason} txId=${transaction.id} txHash=${txHash}`)
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
        console.log(`[deposit-manual] Amount check: claimed=${claimedAmount} onChain=${onChainAmount} tolerance=${AMOUNT_TOLERANCE * 100}% txHash=${txHash}`)
        if (claimedAmount > 0 && onChainAmount > 0) {
          const diff = Math.abs(onChainAmount - claimedAmount)
          const tolerance = claimedAmount * AMOUNT_TOLERANCE
          if (diff > tolerance) {
            console.warn(`[deposit-manual] REJECTED: Amount mismatch — claimed=${claimedAmount} onChain=${onChainAmount} diff=${diff} tolerance=${tolerance} txId=${transaction.id} txHash=${txHash}`)
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
          console.log(`[deposit-manual] INR price fetched: ${token}=${inrPrice} INR at=${priceFetchedAt} txHash=${txHash}`)
        } catch (priceError) {
          console.error(`[deposit-manual] FAILED: INR price fetch failed txId=${transaction.id} txHash=${txHash}`, priceError)
          await prisma.transaction.delete({
            where: { id: transaction.id },
          })
          return NextResponse.json(
            { error: 'Failed to fetch real-time INR conversion rate. Please try again.' },
            { status: 500 }
          )
        }

        const cryptoAmount = parseFloat(actualAmount!)
        const amountInr = cryptoAmount * inrPrice

        // Update transaction and credit balance
        console.log(`[deposit-manual] Completing deposit: cryptoAmount=${cryptoAmount} amountInr=${amountInr} txId=${transaction.id} txHash=${txHash}`)
        const result = await prisma.$transaction(async (prismaTransaction) => {
          const updatedTransaction = await prismaTransaction.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'completed',
              amount: cryptoAmount,
              amountInr,
              conversionRate: inrPrice,
              walletAddress: verifiedFrom || tx.from.toLowerCase(),
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

        console.log(`[deposit-manual] SUCCESS: Deposit completed txId=${transaction.id} cryptoAmount=${cryptoAmount} amountInr=${amountInr} user=${user.id} txHash=${txHash}`)

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
        console.error(`[deposit-manual] FAILED: Unhandled on-chain verification error txId=${transaction.id} txHash=${txHash}`, verifyError)
        await prisma.transaction.delete({
          where: { id: transaction.id },
        })
        return NextResponse.json(
          { error: 'Failed to verify transaction on chain. Please check the hash and try again.' },
          { status: 400 }
        )
      }
    }

    // TRC-20: pending admin verification
    console.log(`[deposit-manual] TRC-20 submitted for admin review txId=${transaction.id} user=${user.id} txHash=${txHash}`)
    return NextResponse.json({
      success: true,
      transaction,
      message: `Deposit of ${amount} USDT via ${networkLabel} submitted. It will be credited after admin verification.`,
    })
  } catch (error) {
    console.error('[deposit-manual] FATAL: Unhandled error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
