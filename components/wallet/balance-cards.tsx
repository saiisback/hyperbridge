'use client'

import { Wallet, TrendingUp, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/utils'

interface BalanceInfo {
  roiBalance: number
  lockedPrincipal: number
  unlockedPrincipal: number
  availableWithdrawal: number
}

interface BalanceCardsProps {
  formattedBalance: string
  balanceInfo: BalanceInfo | null
}

export function BalanceCards({ formattedBalance, balanceInfo }: BalanceCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Total Balance</p>
            <Wallet className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-white">₹{formattedBalance}</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-sm border-green-500/30 rounded-xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Available for Withdrawal</p>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-400">
            ₹{balanceInfo ? formatINR(balanceInfo.availableWithdrawal) : '0.00'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-sm border-red-500/30 rounded-xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Locked Principal</p>
            <Lock className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">
            ₹{balanceInfo ? formatINR(balanceInfo.lockedPrincipal) : '0.00'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
