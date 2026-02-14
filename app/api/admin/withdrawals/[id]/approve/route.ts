import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { rateLimit } from '@/lib/rate-limit'

// Platform wallet (same address used for deposits)
const rawKey = process.env.PLATFORM_PRIVATE_KEY || ''
const PLATFORM_PRIVATE_KEY = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`

// ERC-20 token addresses on Sepolia (must match deposit route)
const ERC20_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  USDT: {
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    decimals: 6,
  },
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error, user: adminUser } = await verifyAdmin(request)
  if (!authorized || !adminUser) {
    return NextResponse.json({ error }, { status: 403 })
  }

  // Rate limit: 10 approvals per 60 seconds per admin
  const rl = rateLimit(`approve:${adminUser.id}`, { limit: 10, windowSecs: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  if (!PLATFORM_PRIVATE_KEY) {
    console.error('PLATFORM_PRIVATE_KEY is not configured')
    return NextResponse.json(
      { error: 'Platform wallet not configured. Contact system administrator.' },
      { status: 500 }
    )
  }

  try {
    const { id } = await params

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.type !== 'withdraw') {
      return NextResponse.json({ error: 'Transaction is not a withdrawal' }, { status: 400 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 })
    }

    if (!transaction.walletAddress) {
      return NextResponse.json({ error: 'No destination wallet address on this transaction' }, { status: 400 })
    }

    // Atomically claim this transaction to prevent concurrent approvals.
    // updateMany with status filter ensures only one request succeeds.
    const claimed = await prisma.transaction.updateMany({
      where: { id, status: 'pending' },
      data: {
        metadata: {
          ...(transaction.metadata as object),
          claimedBy: adminUser.id,
          claimedAt: new Date().toISOString(),
        },
      },
    })
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Transaction is no longer pending' }, { status: 409 })
    }

    const token = transaction.token || 'USDT'
    const destinationAddress = transaction.walletAddress as `0x${string}`
    // Send only the net amount (after 10% admin fee) to the user
    const meta = transaction.metadata as Record<string, unknown> | null
    const amount = meta?.netAmount
      ? String(meta.netAmount)
      : (Number(transaction.amount) * 0.9).toFixed(6)

    // Set up viem clients
    const account = privateKeyToAccount(PLATFORM_PRIVATE_KEY)
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    })
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    })

    let txHash: `0x${string}`

    try {
      if (token === 'ETH') {
        // Send native ETH
        txHash = await walletClient.sendTransaction({
          to: destinationAddress,
          value: parseEther(amount),
        })
      } else {
        // Send ERC-20 token (USDT, etc.)
        const tokenConfig = ERC20_TOKENS[token]
        if (!tokenConfig) {
          return NextResponse.json({ error: `Unsupported token: ${token}` }, { status: 400 })
        }

        txHash = await walletClient.sendTransaction({
          to: tokenConfig.address,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [destinationAddress, parseUnits(amount, tokenConfig.decimals)],
          }),
        })
      }

      // Wait for the transaction to be confirmed
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 120_000,
      })

      if (receipt.status !== 'success') {
        // On-chain transfer failed — mark as failed and refund user
        const meta = transaction.metadata as Record<string, unknown> | null
        const roiDeduction = Number(meta?.roiDeduction ?? 0)

        await prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id },
            data: {
              status: 'failed',
              txHash,
              metadata: {
                ...(transaction.metadata as object),
                approvedBy: adminUser.id,
                approvedAt: new Date().toISOString(),
                transferFailed: true,
                failureReason: 'On-chain transaction reverted',
              },
            },
          })

          // Refund the user's balance
          await tx.profile.update({
            where: { userId: transaction.userId },
            data: {
              availableBalance: { increment: transaction.amountInr || transaction.amount },
              roiBalance: { increment: roiDeduction },
              totalBalance: { increment: transaction.amountInr || transaction.amount },
            },
          })
        })

        return NextResponse.json(
          { error: 'On-chain transfer failed (reverted). User balance has been refunded.' },
          { status: 500 }
        )
      }

      // Transfer succeeded — update transaction as completed with txHash
      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          status: 'completed',
          txHash,
          metadata: {
            ...(transaction.metadata as object),
            approvedBy: adminUser.id,
            approvedAt: new Date().toISOString(),
            transferConfirmedAt: new Date().toISOString(),
          },
        },
      })

      return NextResponse.json({
        success: true,
        transaction: {
          id: updated.id,
          status: updated.status,
          amount: updated.amount.toString(),
          txHash,
        },
      })
    } catch (transferError) {
      console.error('On-chain transfer error:', transferError)

      // Transfer could not be sent — refund user's balance
      const meta2 = transaction.metadata as Record<string, unknown> | null
      const roiDeduction2 = Number(meta2?.roiDeduction ?? 0)

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id },
          data: {
            status: 'failed',
            metadata: {
              ...(transaction.metadata as object),
              approvedBy: adminUser.id,
              approvedAt: new Date().toISOString(),
              transferFailed: true,
              failureReason: transferError instanceof Error ? transferError.message : 'Unknown transfer error',
            },
          },
        })

        await tx.profile.update({
          where: { userId: transaction.userId },
          data: {
            availableBalance: { increment: transaction.amountInr || transaction.amount },
            roiBalance: { increment: roiDeduction2 },
            totalBalance: { increment: transaction.amountInr || transaction.amount },
          },
        })
      })

      return NextResponse.json(
        { error: 'Failed to send on-chain transfer. User balance has been refunded.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Approve withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
