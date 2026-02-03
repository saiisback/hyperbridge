'use client'

import * as React from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'

interface WalletContextType {
  address: string | undefined
  isConnected: boolean
  isConnecting: boolean
  openConnectModal: (() => void) | undefined
  disconnect: () => void
  walletType: string | null
}

const WalletContext = React.createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, isConnecting, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const walletType = React.useMemo(() => {
    if (!connector) return null
    const name = connector.name.toLowerCase()
    if (name.includes('metamask')) return 'metamask'
    if (name.includes('walletconnect')) return 'walletconnect'
    if (name.includes('coinbase')) return 'coinbase'
    return name
  }, [connector])

  const value = React.useMemo<WalletContextType>(() => ({
    address,
    isConnected,
    isConnecting,
    openConnectModal,
    disconnect,
    walletType,
  }), [address, isConnected, isConnecting, openConnectModal, disconnect, walletType])

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
