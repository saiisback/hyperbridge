import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface WalletData {
  address: string
  chainType: string
  walletClient: string | null
}

interface SyncRequest {
  privyId: string
  email: string | null
  wallets: WalletData[]
  referredBy?: string
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json()
    const { privyId, email, wallets, referredBy } = body

    if (!privyId) {
      return NextResponse.json({ error: 'Privy ID is required' }, { status: 400 })
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { privyId },
    })

    if (!user) {
      // Create new user with profile in a transaction
      const primaryWallet = wallets[0]?.address || null

      // Look up referrer if a referral code was provided
      let referrerUser: { id: string } | null = null
      if (referredBy) {
        const referrerProfile = await prisma.profile.findUnique({
          where: { referralCode: referredBy },
          select: { userId: true },
        })
        if (referrerProfile) {
          referrerUser = { id: referrerProfile.userId }
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            privyId,
            email,
            primaryWallet,
            name: null,
            isActive: true,
            kycVerified: false,
          },
        })

        await tx.profile.create({
          data: {
            userId: newUser.id,
            referralCode: generateReferralCode(),
            referredBy: referredBy || null,
            totalBalance: 0,
            availableBalance: 0,
            totalInvested: 0,
          },
        })

        // Create referral record linking referrer to this new user
        if (referrerUser) {
          await tx.referral.create({
            data: {
              referrerId: referrerUser.id,
              refereeId: newUser.id,
              level: 1,
              totalEarnings: 0,
            },
          })
        }

        return newUser
      })

      user = result
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: email || user.email,
          lastLoginAt: new Date(),
        },
      })
    }

    // Sync wallets
    if (user && wallets.length > 0) {
      for (const wallet of wallets) {
        const walletAddress = wallet.address.toLowerCase()

        // Check if wallet already exists
        const existingWallet = await prisma.userWallet.findUnique({
          where: { walletAddress },
        })

        if (!existingWallet) {
          // Add new wallet
          await prisma.userWallet.create({
            data: {
              userId: user.id,
              walletAddress,
              chainType: wallet.chainType,
              walletClient: wallet.walletClient,
              isPrimary: walletAddress === user.primaryWallet?.toLowerCase(),
            },
          })
        } else if (existingWallet.userId !== user.id) {
          // Wallet belongs to another user - this shouldn't happen with Privy
          console.warn(`Wallet ${wallet.address} belongs to another user`)
        }
      }
    }

    // Fetch all user data
    const [profile, userWallets] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id } }),
      prisma.userWallet.findMany({ where: { userId: user.id } }),
    ])

    return NextResponse.json({
      user,
      profile,
      wallets: userWallets,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
