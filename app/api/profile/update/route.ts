import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface UpdateProfileRequest {
  privyId: string
  name?: string
  email?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateProfileRequest = await request.json()
    const { privyId, name, email } = body

    if (!privyId) {
      return NextResponse.json({ error: 'Privy ID is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
      },
    })

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({ user: updatedUser, profile })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
