'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { privyConfig } from '@/lib/privy'
import { AuthProvider } from '@/context/auth-context'
import { WalletProvider } from '@/context/wallet-context'

const queryClient = new QueryClient()

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

export function Providers({ children }: { children: React.ReactNode }) {
  if (!privyAppId) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID is not set')
    return <>{children}</>
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WalletProvider>{children}</WalletProvider>
        </AuthProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

// Keep the old export for backwards compatibility
export { Providers as Web3Provider }
