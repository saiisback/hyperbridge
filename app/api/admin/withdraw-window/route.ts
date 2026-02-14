import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const window = await prisma.withdrawalWindow.findUnique({
      where: { id: 'default' },
    })

    return NextResponse.json({
      opensAt: window?.opensAt?.toISOString() ?? null,
      closesAt: window?.closesAt?.toISOString() ?? null,
      updatedAt: window?.updatedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('Admin withdraw-window GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { authorized, error } = await verifyAdmin(request)
  if (!authorized) {
    return NextResponse.json({ error }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { opensAt, closesAt } = body

    // Validate: if both provided, opensAt must be before closesAt
    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
      return NextResponse.json(
        { error: 'Opens At must be before Closes At' },
        { status: 400 }
      )
    }

    const window = await prisma.withdrawalWindow.upsert({
      where: { id: 'default' },
      update: {
        opensAt: opensAt ? new Date(opensAt) : null,
        closesAt: closesAt ? new Date(closesAt) : null,
      },
      create: {
        id: 'default',
        opensAt: opensAt ? new Date(opensAt) : null,
        closesAt: closesAt ? new Date(closesAt) : null,
      },
    })

    return NextResponse.json({
      opensAt: window.opensAt?.toISOString() ?? null,
      closesAt: window.closesAt?.toISOString() ?? null,
      updatedAt: window.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Admin withdraw-window PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
