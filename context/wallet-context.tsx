'use client'

import * as React from 'react'
import { useWallets, usePrivy } from '@privy-io/react-auth'
import { useAuth } from './auth-context'

interface WalletContextType {
  address: string | undefined
  isConnected: boolean
  isConnecting: boolean
  walletType: string | null
  disconnect: () => void
  connectWallet: () => void
}

const WalletContext = React.createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, logout, login } = useAuth()
  const { ready } = usePrivy()
  const { wallets } = useWallets()

  // Get the primary wallet or first available
  const activeWallet = React.useMemo(() => {
    if (!wallets.length) return null

    // Try to find primary wallet
    if (user.primaryWallet) {
      const primary = wallets.find(
        (w) => w.address.toLowerCase() === user.primaryWallet?.toLowerCase()
      )
      if (primary) return primary
    }

    // Fall back to first wallet
    return wallets[0]
  }, [wallets, user.primaryWallet])

  const walletType = React.useMemo(() => {
    if (!activeWallet) return null
    const clientType = activeWallet.walletClientType?.toLowerCase() || ''
    if (clientType.includes('metamask')) return 'metamask'
    if (clientType.includes('walletconnect')) return 'walletconnect'
    if (clientType.includes('coinbase')) return 'coinbase'
    if (clientType.includes('privy')) return 'embedded'
    return clientType || 'unknown'
  }, [activeWallet])

  const value = React.useMemo<WalletContextType>(
    () => ({
      address: activeWallet?.address,
      isConnected: user.isAuthenticated && !!activeWallet,
      isConnecting: !ready,
      walletType,
      disconnect: logout,
      connectWallet: login,
    }),
    [activeWallet, user.isAuthenticated, ready, walletType, logout, login]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
