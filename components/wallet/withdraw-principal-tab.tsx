'use client'

import { useState } from 'react'
import { Loader2, Clock, Lock, Unlock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShimmerButton } from '@/components/shimmer-button'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import type { TokenKey } from './token-selector'
import { TOKENS } from './token-selector'

interface BalanceInfo {
  roiBalance: number
  lockedPrincipal: number
  unlockedPrincipal: number
  availableWithdrawal: number
}

interface WithdrawPrincipalTabProps {
  selectedToken: TokenKey
  balanceInfo: BalanceInfo | null
  withdrawWindowOpen: boolean
  countdown: string
  hasWindowData: boolean
  onSuccess: () => Promise<void>
}

export function WithdrawPrincipalTab({
  selectedToken,
  balanceInfo,
  withdrawWindowOpen,
  countdown,
  hasWindowData,
  onSuccess,
}: WithdrawPrincipalTabProps) {
  const { refreshUser, getAccessToken } = useAuth()
  const { toast } = useToast()

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const token = TOKENS[selectedToken]
  const unlockedPrincipal = balanceInfo?.unlockedPrincipal ?? 0

  const handleWithdrawPrincipal = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid withdrawal amount',
        variant: 'destructive',
      })
      return
    }

    if (!withdrawAddress) {
      toast({
        title: 'Missing address',
        description: 'Please enter a destination wallet address',
        variant: 'destructive',
      })
      return
    }

    if (parseFloat(withdrawAmount) > unlockedPrincipal) {
      toast({
        title: 'Insufficient principal',
        description: `Maximum available unlocked principal: ₹${formatINR(unlockedPrincipal)}`,
        variant: 'destructive',
      })
      return
    }

    setIsWithdrawing(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')
      const response = await authFetch('/api/wallet/withdraw-principal', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: withdrawAmount,
          walletAddress: withdrawAddress,
          token: selectedToken,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Principal withdrawal submitted',
          description: 'Your principal withdrawal request is pending admin approval. This may take 24-48 hours.',
        })
        setWithdrawAmount('')
        setWithdrawAddress('')
        await refreshUser()
        await onSuccess()
      } else {
        const errorData = await response.json()
        toast({
          title: 'Withdrawal failed',
          description: errorData.error || 'Failed to process principal withdrawal',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Principal withdrawal error:', error)
      toast({
        title: 'Withdrawal failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsWithdrawing(false)
    }
  }

  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Withdraw Principal ({token.name})</CardTitle>
        <CardDescription className="text-white/50">
          Withdraw your principal investment amount — no platform fee
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!withdrawWindowOpen && hasWindowData ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
              <Clock className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-red-400">Withdrawals are currently closed</p>
              {countdown && (
                <p className="text-sm text-white/70">
                  Opens in <span className="text-white font-mono text-base">{countdown}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {withdrawWindowOpen && countdown && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-400">Withdrawals are open</p>
                  <p className="text-sm text-white/70 mt-0.5">
                    Closes in <span className="text-white font-mono">{countdown}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Unlocked Principal</span>
                <span className="text-xl font-bold text-orange-400">
                  ₹{formatINR(unlockedPrincipal)}
                </span>
              </div>
              {balanceInfo && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50 flex items-center gap-1">
                      <Unlock className="h-3 w-3" /> Available to withdraw
                    </span>
                    <span className="text-orange-400">₹{formatINR(unlockedPrincipal)}</span>
                  </div>
                  {balanceInfo.lockedPrincipal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Locked Principal
                      </span>
                      <span className="text-red-400">₹{formatINR(balanceInfo.lockedPrincipal)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="principalAmount" className="text-white/70">
                Amount (₹ INR)
              </Label>
              <Input
                id="principalAmount"
                type="number"
                step="1"
                min="0"
                placeholder="Enter amount in ₹"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="principalAddress" className="text-white/70">
                Wallet Address
              </Label>
              <Input
                id="principalAddress"
                placeholder="Enter destination wallet address"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 font-mono"
              />
            </div>

            <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Withdrawal Amount</span>
                <span className="text-white">
                  ₹{withdrawAmount ? formatINR(parseFloat(withdrawAmount)) : '0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Platform Fee</span>
                <span className="text-green-400">₹0.00 (No fee)</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex items-center justify-between text-sm">
                <span className="text-white/50">You will receive</span>
                <span className="text-orange-500 font-semibold">
                  ₹{withdrawAmount ? formatINR(parseFloat(withdrawAmount)) : '0.00'}
                </span>
              </div>
            </div>

            <ShimmerButton
              shimmerColor="#f97316"
              background="rgba(249, 115, 22, 1)"
              className="w-full text-white"
              onClick={handleWithdrawPrincipal}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Withdraw Principal (${token.name})`
              )}
            </ShimmerButton>
          </>
        )}
      </CardContent>
    </Card>
  )
}
