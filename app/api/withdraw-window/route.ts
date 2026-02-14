import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const window = await prisma.withdrawalWindow.findUnique({
      where: { id: 'default' },
    })

    const now = new Date()
    const opensAt = window?.opensAt ?? null
    const closesAt = window?.closesAt ?? null

    // If neither is set, withdrawals are always open
    let isOpen = true
    if (opensAt && closesAt) {
      isOpen = now >= opensAt && now <= closesAt
    } else if (opensAt) {
      isOpen = now >= opensAt
    } else if (closesAt) {
      isOpen = now <= closesAt
    }

    return NextResponse.json({
      isOpen,
      opensAt: opensAt?.toISOString() ?? null,
      closesAt: closesAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('Withdraw-window status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
