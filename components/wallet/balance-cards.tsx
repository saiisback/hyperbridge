'use client'

import { TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/utils'

interface BalanceInfo {
  roiBalance: number
  lockedPrincipal: number
  unlockedPrincipal: number
  availableWithdrawal: number
  totalInvested: number
}

interface BalanceCardsProps {
  balanceInfo: BalanceInfo | null
}

export function BalanceCards({ balanceInfo }: BalanceCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-sm border-green-500/30 rounded-xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Available for Withdraw</p>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-400">
            ₹{balanceInfo ? formatINR(balanceInfo.availableWithdrawal) : '0.00'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">Invested Principal</p>
            <Wallet className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            ₹{balanceInfo ? formatINR(balanceInfo.totalInvested) : '0.00'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
