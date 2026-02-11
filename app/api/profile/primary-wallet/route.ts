import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface SetPrimaryWalletRequest {
  privyId: string
  walletAddress: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SetPrimaryWalletRequest = await request.json()
    const { privyId, walletAddress } = body

    if (!privyId) {
      return NextResponse.json({ error: 'Privy ID is required' }, { status: 400 })
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { wallets: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const normalizedAddress = walletAddress.toLowerCase()
    const walletExists = user.wallets.some(
      (w) => w.walletAddress.toLowerCase() === normalizedAddress
    )

    if (!walletExists) {
      return NextResponse.json({ error: 'Wallet not linked to this account' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Unset all wallets as primary for this user
      await tx.userWallet.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false },
      })

      // Set the chosen wallet as primary
      await tx.userWallet.updateMany({
        where: {
          userId: user.id,
          walletAddress: normalizedAddress,
        },
        data: { isPrimary: true },
      })

      // Update user's primaryWallet field
      await tx.user.update({
        where: { id: user.id },
        data: { primaryWallet: normalizedAddress },
      })
    })

    const [updatedUser, wallets, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.userWallet.findMany({ where: { userId: user.id } }),
      prisma.profile.findUnique({ where: { userId: user.id } }),
    ])

    return NextResponse.json({ user: updatedUser, wallets, profile })
  } catch (error) {
    console.error('Set primary wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
