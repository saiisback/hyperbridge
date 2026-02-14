'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, History, Landmark } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { formatINR } from '@/lib/utils'
import { useCountdown } from '@/hooks/use-countdown'
import { BalanceCards } from '@/components/wallet/balance-cards'
import { TokenSelector } from '@/components/wallet/token-selector'
import { DepositTab } from '@/components/wallet/deposit-tab'
import { WithdrawTab } from '@/components/wallet/withdraw-tab'
import { TransactionHistory } from '@/components/wallet/transaction-history'
import { WithdrawPrincipalTab } from '@/components/wallet/withdraw-principal-tab'
import type { TokenKey } from '@/components/wallet/token-selector'
import type { Transaction } from '@/components/wallet/transaction-history'

interface BalanceInfo {
  roiBalance: number
  lockedPrincipal: number
  unlockedPrincipal: number
  availableWithdrawal: number
}

export default function WalletPage() {
  const { user, getAccessToken } = useAuth()

  const [selectedToken, setSelectedToken] = useState<TokenKey>('ETH')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null)

  // Withdrawal window state
  const [withdrawWindowData, setWithdrawWindowData] = useState<{
    isOpen: boolean
    opensAt: string | null
    closesAt: string | null
  }>({ isOpen: true, opensAt: null, closesAt: null })

  const { countdown, isOpen: withdrawWindowOpen } = useCountdown(withdrawWindowData)

  const availableBalance = user.profile?.availableBalance
    ? parseFloat(user.profile.availableBalance.toString())
    : 0
  const formattedBalance = formatINR(availableBalance)

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user.privyId) return
    setIsLoadingTransactions(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const response = await authFetch('/api/wallet/transactions', accessToken)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [user.privyId, getAccessToken])

  // Fetch balance breakdown
  const fetchBalanceInfo = useCallback(async () => {
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await authFetch('/api/dashboard/stats', accessToken)
      if (res.ok) {
        const data = await res.json()
        setBalanceInfo({
          roiBalance: data.roiBalance ?? 0,
          lockedPrincipal: data.lockedPrincipal ?? 0,
          unlockedPrincipal: data.unlockedPrincipal ?? 0,
          availableWithdrawal: data.availableWithdrawal ?? 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch balance info:', error)
    }
  }, [getAccessToken])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    fetchBalanceInfo()
  }, [fetchBalanceInfo])

  // Fetch withdrawal window status
  useEffect(() => {
    const fetchWindow = async () => {
      try {
        const res = await fetch('/api/withdraw-window')
        if (res.ok) {
          const data = await res.json()
          setWithdrawWindowData({
            isOpen: data.isOpen,
            opensAt: data.opensAt,
            closesAt: data.closesAt,
          })
        }
      } catch (error) {
        console.error('Failed to fetch withdrawal window:', error)
      }
    }
    fetchWindow()
  }, [])

  const handleDepositWithdrawSuccess = async () => {
    await fetchBalanceInfo()
    await fetchTransactions()
  }

  return (
    <div className="space-y-6">
      <BalanceCards formattedBalance={formattedBalance} balanceInfo={balanceInfo} />

      <TokenSelector selectedToken={selectedToken} onSelectToken={setSelectedToken} />

      <Tabs defaultValue="deposit" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger
            value="deposit"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger
            value="withdraw-principal"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Landmark className="h-4 w-4 mr-2" />
            Withdraw Principal
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <History className="h-4 w-4 mr-2" />
            History
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
            hasWindowData={!!(withdrawWindowData.opensAt || withdrawWindowData.closesAt)}
            onSuccess={handleDepositWithdrawSuccess}
          />
        </TabsContent>

        <TabsContent value="withdraw-principal">
          <WithdrawPrincipalTab
            selectedToken={selectedToken}
            balanceInfo={balanceInfo}
            withdrawWindowOpen={withdrawWindowOpen}
            countdown={countdown}
            hasWindowData={!!(withdrawWindowData.opensAt || withdrawWindowData.closesAt)}
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
