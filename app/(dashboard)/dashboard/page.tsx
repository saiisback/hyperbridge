'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Wallet, TrendingUp, IndianRupee, ArrowUpRight, ArrowDownRight, Activity, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWallet } from '@/hooks/use-wallet'
import { useAuth } from '@/context/auth-context'
import { cn, formatINR, timeAgo, formatActivityDescription } from '@/lib/utils'
import { authFetch } from '@/lib/api'

// Lazy load chart components (recharts is ~200KB)
const BalanceTrendChart = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then((mod) => ({ default: mod.BalanceTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const EarningsChart = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then((mod) => ({ default: mod.EarningsChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const PortfolioChart = dynamic(
  () => import('@/components/dashboard/dashboard-charts').then((mod) => ({ default: mod.PortfolioChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardContent className="pt-6">
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </CardContent>
    </Card>
  )
}

interface DashboardStats {
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
}

export default function DashboardPage() {
  const { address } = useWallet()
  const { user, getAccessToken } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user.privyId) return

    const fetchStats = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return
        const res = await authFetch('/api/dashboard/stats', accessToken)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user.privyId, getAccessToken])

  const statCards = useMemo(() => [
    {
      title: 'Total Balance',
      value: stats ? `₹${formatINR(stats.totalBalance)}` : '₹0.00',
      icon: Wallet,
    },
    {
      title: 'ROI Income',
      value: stats ? `₹${formatINR(stats.totalRoiIncome)}` : '₹0.00',
      icon: TrendingUp,
    },
    {
      title: 'Referral Income',
      value: stats ? `₹${formatINR(stats.totalReferralIncome)}` : '₹0.00',
      icon: IndianRupee,
    },
  ], [stats])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const recentActivities = stats?.recentActivities ?? []
  const monthlyEarnings = stats?.monthlyEarnings ?? []
  const balanceHistory = stats?.balanceHistory ?? []
  const portfolioData = stats?.portfolioData ?? []

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Welcome Back{' '}
          <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">
            {address ? `${address.slice(0, 6)}...` : 'User'}
          </span>
        </h1>
        <p className="text-white/60">
          Here&apos;s an overview of your investment portfolio
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="bg-black/50 backdrop-blur-sm border-white/10 hover:border-orange-500/30 transition-all duration-300 rounded-xl hover:shadow-lg hover:shadow-orange-500/10"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/70">
                {stat.title}
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
                <stat.icon className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <BalanceTrendChart data={balanceHistory} />
        <EarningsChart data={monthlyEarnings} />
      </div>

      {/* Portfolio Distribution & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        <PortfolioChart data={portfolioData} />

        {/* Recent Activity */}
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-white">Recent Activity</CardTitle>
            </div>
            <CardDescription className="text-white/50">
              Your latest transactions and earnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div
                        className={cn(
                          'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full shrink-0',
                          activity.type === 'withdraw'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-green-500/20 text-green-500'
                        )}
                      >
                        {activity.type === 'withdraw' ? (
                          <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">
                          {formatActivityDescription(activity.type)}
                        </p>
                        <p className="text-xs text-white/50">{timeAgo(activity.createdAt)}</p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'font-semibold text-sm shrink-0',
                        activity.type === 'withdraw'
                          ? 'text-red-500'
                          : 'text-green-500'
                      )}
                    >
                      {activity.type === 'withdraw' ? '-' : '+'}₹{formatINR(activity.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-white/40">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
