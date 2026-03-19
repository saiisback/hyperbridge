'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { Toaster } from 'sonner'
import { WmAuthProvider } from './wm-auth'

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

export function WmProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  if (!privyAppId) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#FB923C',
          logo: '/logo.svg',
          showWalletLoginFirst: false,
        },
        loginMethods: ['google', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WmAuthProvider>
          {children}
        </WmAuthProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </QueryClientProvider>
    </PrivyProvider>
  )
}
