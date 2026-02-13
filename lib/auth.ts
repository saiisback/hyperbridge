import { NextRequest } from 'next/server'
import { PrivyClient } from '@privy-io/node'

const privyClient = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
})

/**
 * Verifies the Privy access token from the Authorization header.
 * Returns the verified privyId (user_id) or null if invalid/missing.
 */
export async function verifyAuth(request: NextRequest): Promise<{ privyId: string | null }> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return { privyId: null }
    }

    const token = authHeader.slice(7)
    const result = await privyClient.utils().auth().verifyAccessToken(token)
    return { privyId: result.user_id }
  } catch (error) {
    console.error('Auth token verification failed:', error)
    return { privyId: null }
  }
}
