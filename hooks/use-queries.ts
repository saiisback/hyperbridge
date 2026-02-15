import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

export interface DashboardStatsResponse {
  totalBalance: number
  availableBalance: number
  totalInvested: number
  totalRoiIncome: number
  totalReferralIncome: number
  recentActivities: {
    id: string
    type: string
    amount: number
    status: string
    createdAt: string
  }[]
  monthlyEarnings: { month: string; roi: number; referral: number }[]
  balanceHistory: { day: string; balance: number }[]
  portfolioData: { name: string; value: number; color: string }[]
  roiBalance: number
  lockedPrincipal: number
  unlockedPrincipal: number
  availableWithdrawal: number
}

export interface IncomeResponse {
  totalRoiIncome: number
  todayRoi: number
  totalInvested: number
  dailyRoiRate: number
  daysActive: number
  roiHistory: { date: string; amount: number; percentage: string; status: string }[]
  totalReferralIncome: number
  directMembers: number
  directEarnings: number
  level2Members: number
  level2Earnings: number
  referralHistory: { date: string; from: string; amount: number; level: number; type: string }[]
  referralCode: string | null
}

export interface WithdrawWindowResponse {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
}

export function useDashboardStats() {
  const { user, getAccessToken } = useAuth()

  return useQuery<DashboardStatsResponse>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('No access token')
      const res = await authFetch('/api/dashboard/stats', accessToken)
      if (!res.ok) throw new Error('Failed to fetch dashboard stats')
      return res.json()
    },
    enabled: !!user.privyId,
  })
}

export function useIncomeData() {
  const { user, getAccessToken } = useAuth()

  return useQuery<IncomeResponse>({
    queryKey: ['income'],
    queryFn: async () => {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('No access token')
      const res = await authFetch('/api/income', accessToken)
      if (!res.ok) throw new Error('Failed to fetch income data')
      return res.json()
    },
    enabled: !!user.privyId,
  })
}

export function useWalletTransactions() {
  const { user, getAccessToken } = useAuth()

  return useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: async () => {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('No access token')
      const res = await authFetch('/api/wallet/transactions', accessToken)
      if (!res.ok) throw new Error('Failed to fetch transactions')
      const data = await res.json()
      return data.transactions || []
    },
    enabled: !!user.privyId,
  })
}

export function useWithdrawWindow() {
  return useQuery<WithdrawWindowResponse>({
    queryKey: ['withdraw-window'],
    queryFn: async () => {
      const res = await fetch('/api/withdraw-window')
      if (!res.ok) throw new Error('Failed to fetch withdraw window')
      return res.json()
    },
  })
}
