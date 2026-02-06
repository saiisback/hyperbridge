import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function verifyAdmin(request: NextRequest) {
  const privyId = request.headers.get('x-privy-id')

  if (!privyId) {
    return { authorized: false, error: 'Missing authentication header', user: null }
  }

  const user = await prisma.user.findUnique({
    where: { privyId },
    include: { profile: true },
  })

  if (!user) {
    return { authorized: false, error: 'User not found', user: null }
  }

  if (user.role !== 'admin') {
    return { authorized: false, error: 'Insufficient permissions', user: null }
  }

  return { authorized: true, error: null, user }
}
