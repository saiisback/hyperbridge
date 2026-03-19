'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWmAuth } from '../wm-auth'
import { authFetch } from '@/lib/api'
import { Loader2, CheckCircle, XCircle, Settings } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Transaction {
  id: string
  userName: string | null
  userEmail: string | null
  referralCode: string | null
  amountInr: string | null
  cryptoAmount: string
  token: string | null
  conversionRate: string | null
  status: string
  utr: string | null
  remark: string | null
  createdAt: string
}

interface Stats {
  pendingCount: number
  completedToday: number
  totalVolume: string
}

interface TransactionsResponse {
  transactions: Transaction[]
  stats: Stats
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading, getAccessToken } = useWmAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user && user.role !== 'admin'))) {
      router.push('/winfinity-money')
    }
  }, [authLoading, isAuthenticated, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['wm-admin-transactions', statusFilter, page],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await authFetch(`/api/winfinity-money/admin/transactions?${params}`, token)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json() as Promise<TransactionsResponse>
    },
    enabled: isAuthenticated && user?.role === 'admin',
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'completed' | 'failed' }) => {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')
      const res = await authFetch(`/api/winfinity-money/admin/transactions/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wm-admin-transactions'] })
      toast.success('Transaction updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  if (authLoading || (isAuthenticated && !user)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = data?.stats
  const transactions = data?.transactions || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin Dashboard</h2>
        <Link href="/admin/rates">
          <Button variant="outline" size="sm">
            <Settings className="size-4" />
            Rates
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{stats?.pendingCount ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Completed Today</p>
            <p className="text-2xl font-bold">{stats?.completedToday ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Volume</p>
            <p className="text-2xl font-bold">
              ₹{stats ? parseFloat(stats.totalVolume).toLocaleString() : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'pending', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No transactions found</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {tx.userName || tx.userEmail || 'Unknown'}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        tx.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : tx.status === 'completed'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>₹{tx.amountInr ? parseFloat(tx.amountInr).toLocaleString() : '-'}</span>
                      <span>{tx.cryptoAmount} {tx.token}</span>
                      {tx.utr && <span>UTR: {tx.utr}</span>}
                      {tx.remark && <span>Remark: {tx.remark}</span>}
                      <span>{new Date(tx.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {tx.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                        onClick={() => updateMutation.mutate({ id: tx.id, status: 'completed' })}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => updateMutation.mutate({ id: tx.id, status: 'failed' })}
                        disabled={updateMutation.isPending}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
