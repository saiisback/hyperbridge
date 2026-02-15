'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, History, Landmark } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/auth-context'
import { formatINR } from '@/lib/utils'
import { useCountdown } from '@/hooks/use-countdown'
import { useDashboardStats, useWalletTransactions, useWithdrawWindow } from '@/hooks/use-queries'
import { BalanceCards } from '@/components/wallet/balance-cards'
import { TokenSelector } from '@/components/wallet/token-selector'
import { DepositTab } from '@/components/wallet/deposit-tab'
import { WithdrawTab } from '@/components/wallet/withdraw-tab'
import { TransactionHistory } from '@/components/wallet/transaction-history'
import { WithdrawPrincipalTab } from '@/components/wallet/withdraw-principal-tab'
import type { TokenKey } from '@/components/wallet/token-selector'

export default function WalletPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [selectedToken, setSelectedToken] = useState<TokenKey>('ETH')

  // Query hooks
  const { data: statsData, isLoading: isLoadingBalance } = useDashboardStats()
  const { data: transactions = [], isLoading: isLoadingTransactions } = useWalletTransactions()
  const { data: withdrawWindowData } = useWithdrawWindow()

  const balanceInfo = useMemo(() =>
    statsData
      ? {
          roiBalance: statsData.roiBalance ?? 0,
          lockedPrincipal: statsData.lockedPrincipal ?? 0,
          unlockedPrincipal: statsData.unlockedPrincipal ?? 0,
          availableWithdrawal: statsData.availableWithdrawal ?? 0,
        }
      : null,
    [statsData]
  )

  const { countdown, isOpen: withdrawWindowOpen } = useCountdown(
    withdrawWindowData ?? { isOpen: true, opensAt: null, closesAt: null }
  )

  const availableBalance = user.profile?.availableBalance
    ? parseFloat(user.profile.availableBalance.toString())
    : 0
  const formattedBalance = formatINR(availableBalance)

  const handleDepositWithdrawSuccess = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] }),
    ])
  }, [queryClient])

  return (
    <div className="space-y-6">
      {isLoadingBalance ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <Skeleton className="h-4 w-24 mb-3 bg-white/10" />
              <Skeleton className="h-8 w-32 bg-white/10" />
            </div>
          ))}
        </div>
      ) : (
        <BalanceCards formattedBalance={formattedBalance} balanceInfo={balanceInfo} />
      )}

      <TokenSelector selectedToken={selectedToken} onSelectToken={setSelectedToken} />

      <Tabs defaultValue="deposit" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 w-full flex overflow-x-auto">
          <TabsTrigger
            value="deposit"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex-1 min-w-0"
          >
            <ArrowDownToLine className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Deposit</span>
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex-1 min-w-0"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">Withdraw</span>
          </TabsTrigger>
          <TabsTrigger
            value="withdraw-principal"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex-1 min-w-0"
          >
            <Landmark className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline truncate">Withdraw Principal</span>
            <span className="sm:hidden truncate">Principal</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex-1 min-w-0"
          >
            <History className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
            <span className="truncate">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <DepositTab
            selectedToken={selectedToken}
            onSuccess={handleDepositWithdrawSuccess}
          />
        </TabsContent>

        <TabsContent value="withdraw">
          <WithdrawTab
            selectedToken={selectedToken}
            availableBalance={availableBalance}
            formattedBalance={formattedBalance}
            balanceInfo={balanceInfo}
            withdrawWindowOpen={withdrawWindowOpen}
            countdown={countdown}
            hasWindowData={!!(withdrawWindowData?.opensAt || withdrawWindowData?.closesAt)}
            onSuccess={handleDepositWithdrawSuccess}
          />
        </TabsContent>

        <TabsContent value="withdraw-principal">
          <WithdrawPrincipalTab
            selectedToken={selectedToken}
            balanceInfo={balanceInfo}
            withdrawWindowOpen={withdrawWindowOpen}
            countdown={countdown}
            hasWindowData={!!(withdrawWindowData?.opensAt || withdrawWindowData?.closesAt)}
            onSuccess={handleDepositWithdrawSuccess}
          />
        </TabsContent>

        <TabsContent value="history">
          <TransactionHistory
            transactions={transactions}
            isLoading={isLoadingTransactions}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
