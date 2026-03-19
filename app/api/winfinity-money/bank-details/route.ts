import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getPlatformBankDetails } from '@/lib/bank-config'

export async function GET(request: NextRequest) {
  try {
    const { privyId } = await verifyAuth(request)
    if (!privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(getPlatformBankDetails())
  } catch (error) {
    console.error('Bank details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
