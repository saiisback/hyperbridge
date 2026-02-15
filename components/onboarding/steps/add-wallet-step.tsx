'use client'

import { useState } from 'react'
import { useAuthState, useAuthActions } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShimmerButton } from '@/components/shimmer-button'
import { Wallet, CheckCircle } from 'lucide-react'

interface AddWalletStepProps {
  onComplete: () => void
}

export function AddWalletStep({ onComplete }: AddWalletStepProps) {
  const { user } = useAuthState()
  const { linkWallet, setPrimaryWallet } = useAuthActions()
  const [isCompleting, setIsCompleting] = useState(false)

  const hasWallet = user.wallets.length > 0
  const primaryWallet = user.primaryWallet

  const handleConnectWallet = async () => {
    linkWallet()
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      // If wallet exists but no primary wallet is set, set the first one
      if (hasWallet && !primaryWallet) {
        await setPrimaryWallet(user.wallets[0].walletAddress)
      }
      await onComplete()
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
            <Wallet className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-white">Add a Wallet</CardTitle>
            <CardDescription className="text-white/50">
              Connect a wallet to receive payments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasWallet ? (
          <div className="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/20 p-4">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-400">Wallet Connected</p>
              <p className="text-xs text-white/50 truncate">
                {primaryWallet || user.wallets[0].walletAddress}
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConnectWallet}
            className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Wallet className="h-5 w-5 text-white/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Connect Wallet</p>
              <p className="text-xs text-white/50">MetaMask, WalletConnect, Coinbase</p>
            </div>
          </button>
        )}

        <ShimmerButton
          shimmerColor="#ffffff"
          shimmerSize="0.05em"
          shimmerDuration="3s"
          borderRadius="12px"
          background={hasWallet ? 'rgba(249, 115, 22, 1)' : 'rgba(255, 255, 255, 0.1)'}
          className="w-full py-3 font-semibold"
          disabled={!hasWallet || isCompleting}
          onClick={handleComplete}
        >
          {isCompleting ? 'Completing...' : 'Complete Setup'}
        </ShimmerButton>

        {!hasWallet && (
          <p className="text-center text-xs text-white/40">
            Connect a wallet to continue
          </p>
        )}
      </CardContent>
    </Card>
  )
}
