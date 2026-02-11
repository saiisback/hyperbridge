'use client'

import { useEffect, useState } from 'react'
import { Users, ArrowDownToLine, Wallet, ArrowUpFromLine, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { formatINR } from '@/lib/utils'

interface Stats {
  totalUsers: number
  newUsersLast30d: number
  totalDeposits: string
  totalDepositCount: number
  totalBalance: string
  pendingWithdrawalCount: number
  pendingWithdrawalSum: string
}

interface RecentUser {
  id: string
  name: string | null
  email: string | null
  createdAt: string
  totalBalance: string
}

interface RecentTransaction {
  id: string
  type: string
  amount: string
  amountInr: string | null
  status: string
  createdAt: string
  user: { name: string | null; email: string | null }
}

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user.privyId) return

    async function fetchData() {
      setIsLoading(true)
      try {
        const [statsRes, usersRes, txRes] = await Promise.all([
          adminFetch('/api/admin/stats', user.privyId!),
          adminFetch('/api/admin/users?limit=5', user.privyId!),
          adminFetch('/api/admin/transactions?limit=5', user.privyId!),
        ])

        if (statsRes.ok) setStats(await statsRes.json())
        if (usersRes.ok) {
          const data = await usersRes.json()
          setRecentUsers(data.users)
        }
        if (txRes.ok) {
          const data = await txRes.json()
          setRecentTransactions(data.transactions)
        }
      } catch (error) {
        console.error('Failed to fetch admin data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user.privyId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      subtitle: `${stats?.newUsersLast30d || 0} new in last 30 days`,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Total Deposits',
      value: `₹${formatINR(parseFloat(stats?.totalDeposits || '0'))}`,
      subtitle: `${stats?.totalDepositCount || 0} deposits`,
      icon: ArrowDownToLine,
      color: 'green',
    },
    {
      title: 'Total Balance',
      value: `₹${formatINR(parseFloat(stats?.totalBalance || '0'))}`,
      subtitle: 'Across all users',
      icon: Wallet,
      color: 'orange',
    },
    {
      title: 'Pending Withdrawals',
      value: stats?.pendingWithdrawalCount || 0,
      subtitle: `₹${formatINR(parseFloat(stats?.pendingWithdrawalSum || '0'))} pending`,
      icon: ArrowUpFromLine,
      color: 'red',
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  }

  const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-500',
    green: 'bg-green-500/20 border-green-500/30 text-green-500',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-500',
    red: 'bg-red-500/20 border-red-500/30 text-red-500',
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className={`bg-gradient-to-br ${colorMap[card.color]} backdrop-blur-sm rounded-xl`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">{card.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  <p className="text-xs text-white/50 mt-1">{card.subtitle}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${iconColorMap[card.color]}`}>
                  <card.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Users</CardTitle>
            <CardDescription className="text-white/50">Latest registered users</CardDescription>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-white/50 text-center py-4">No users yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Name</TableHead>
                    <TableHead className="text-white/50">Email</TableHead>
                    <TableHead className="text-white/50">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map((u) => (
                    <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">{u.name || 'Anonymous'}</TableCell>
                      <TableCell className="text-white/70">{u.email || '-'}</TableCell>
                      <TableCell className="text-orange-500">
                        ₹{formatINR(parseFloat(u.totalBalance))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Transactions</CardTitle>
            <CardDescription className="text-white/50">Latest activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-white/50 text-center py-4">No transactions yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">User</TableHead>
                    <TableHead className="text-white/50">Type</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">
                        {tx.user.name || tx.user.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-white capitalize">{tx.type}</TableCell>
                      <TableCell
                        className={tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}
                      >
                        {tx.type === 'deposit' ? '+' : '-'}
                        ₹{formatINR(parseFloat(tx.amountInr || tx.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tx.status === 'completed'
                              ? 'bg-green-500/20 text-green-500 border-green-500/50'
                              : tx.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                              : 'bg-red-500/20 text-red-500 border-red-500/50'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
