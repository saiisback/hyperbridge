import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPublicClient, http, formatEther } from 'viem'
import { sepolia } from 'viem/chains'

// Platform deposit address on Sepolia
const PLATFORM_DEPOSIT_ADDRESS = '0x531dB6ca6baE892b191f7F9122beA32F228fbee1'.toLowerCase()

// Create a public client for Sepolia to verify transactions
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://rpc.sepolia.org'),
})

interface DepositRequest {
  privyId: string
  txHash: string
  amount: string // Amount in ETH as string
  walletAddress: string
}

export async function POST(request: NextRequest) {
  try {
    const body: DepositRequest = await request.json()
    const { privyId, txHash, amount, walletAddress } = body

    // Validate required fields
    if (!privyId) {
      return NextResponse.json({ error: 'Privy ID is required' }, { status: 400 })
    }
    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }
    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }

    // Find user by privyId
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
      const txReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: 1,
        timeout: 60_000, // 60 second timeout
      })

      // Verify the transaction was successful
      if (txReceipt.status !== 'success') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json({ error: 'Transaction failed on chain' }, { status: 400 })
      }

      // Get the actual transaction to verify recipient
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      })

      // Verify the recipient is our platform address
      if (tx.to?.toLowerCase() !== PLATFORM_DEPOSIT_ADDRESS) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'failed' },
        })
        return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
      }

      // Get the actual ETH value from the transaction
      const actualAmountEth = formatEther(tx.value)

      // Update transaction and profile balance in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update transaction to completed with actual amount
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'completed',
            amount: parseFloat(actualAmountEth),
          },
        })

        // Update profile balance and totalInvested
        const updatedProfile = await tx.profile.update({
          where: { userId: user.id },
          data: {
            availableBalance: {
              increment: parseFloat(actualAmountEth),
            },
            totalBalance: {
              increment: parseFloat(actualAmountEth),
            },
            totalInvested: {
              increment: parseFloat(actualAmountEth),
            },
          },
        })

        return { transaction: updatedTransaction, profile: updatedProfile }
      })

      return NextResponse.json({
        success: true,
        transaction: result.transaction,
        profile: result.profile,
        message: 'Deposit confirmed and balance updated',
      })
    } catch (verifyError) {
      console.error('Transaction verification error:', verifyError)
      
      // Update transaction status to failed
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
