import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get privyId from query params
    const { searchParams } = new URL(request.url)
    const privyId = searchParams.get('privyId')

    if (!privyId) {
      return NextResponse.json({ error: 'Privy ID is required' }, { status: 400 })
    }

    // Find user by privyId
    const user = await prisma.user.findUnique({
      where: { privyId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch transactions for the user, ordered by date descending
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 transactions
    })

    // Format transactions for the frontend
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      amountInr: tx.amountInr?.toString() ?? null,
      conversionRate: tx.conversionRate?.toString() ?? null,
      token: tx.token,
      status: tx.status,
      date: tx.createdAt.toISOString(),
      txHash: tx.txHash,
      walletAddress: tx.walletAddress,
      metadata: tx.metadata,
    }))

    return NextResponse.json({
      transactions: formattedTransactions,
    })
  } catch (error) {
    console.error('Transactions fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
