import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import crypto from 'crypto'
import { z } from 'zod'

const syncSchema = z.object({
  email: z.string().email().nullable().optional(),
  wallets: z.array(z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    chainType: z.string(),
    walletClient: z.string().nullable(),
  })).default([]),
  referredBy: z.string().regex(/^[A-Z0-9]{8}$/).optional().or(z.literal('')),
})

function generateReferralCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 8)
}

export async function POST(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = syncSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const { email, wallets, referredBy } = parsed.data

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

      // Generate a unique referral code with retry
      let referralCode = generateReferralCode()
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await prisma.profile.findUnique({
          where: { referralCode },
          select: { userId: true },
        })
        if (!existing) break
        referralCode = generateReferralCode()
      }

      try {
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
              referralCode,
              referredBy: referredBy || null,
              totalBalance: 0,
              availableBalance: 0,
              totalInvested: 0,
            },
          })

          // Self-referral prevention: only create referral if referrer is not the new user
          if (referrerUser && referrerUser.id !== newUser.id) {
            await tx.referral.create({
              data: {
                referrerId: referrerUser.id,
                refereeId: newUser.id,
                level: 1,
                totalEarnings: 0,
              },
            })

            // Create L2 referral if the referrer was also referred by someone (grandparent)
            const grandparentReferral = await tx.referral.findFirst({
              where: { refereeId: referrerUser.id, level: 1 },
            })
            if (grandparentReferral && grandparentReferral.referrerId !== newUser.id) {
              await tx.referral.create({
                data: {
                  referrerId: grandparentReferral.referrerId,
                  refereeId: newUser.id,
                  level: 2,
                  totalEarnings: 0,
                },
              })
            }
          }

          return newUser
        })

        user = result
      } catch (txError: any) {
        // Race condition: another request created this user between our findUnique and create
        if (txError?.code === 'P2002') {
          user = await prisma.user.findUnique({ where: { privyId } })
          if (!user) {
            throw txError
          }
        } else {
          throw txError
        }
      }
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
