import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

export function useDashboardStats() {
  const { user, getAccessToken } = useAuth()

  return useQuery({
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

  return useQuery({
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
  return useQuery({
    queryKey: ['withdraw-window'],
    queryFn: async () => {
      const res = await fetch('/api/withdraw-window')
      if (!res.ok) throw new Error('Failed to fetch withdraw window')
      return res.json()
    },
  })
}
