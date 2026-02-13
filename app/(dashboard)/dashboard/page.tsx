'use client'

import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, IndianRupee, ArrowUpRight, ArrowDownRight, Activity, Loader2 } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useWallet } from '@/hooks/use-wallet'
import { useAuth } from '@/context/auth-context'
import { cn, formatINR } from '@/lib/utils'
import { authFetch } from '@/lib/api'

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

const earningsConfig = {
  roi: { label: 'ROI Income', color: '#f97316' },
  referral: { label: 'Referral Income', color: '#3b82f6' },
}

const balanceConfig = {
  balance: { label: 'Balance', color: '#f97316' },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const statCards = [
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
  ]

  const recentActivities = stats?.recentActivities ?? []
  const monthlyEarnings = stats?.monthlyEarnings ?? []
  const balanceHistory = stats?.balanceHistory ?? []
  const portfolioData = stats?.portfolioData ?? []

  const formatActivityDescription = (type: string) => {
    switch (type) {
      case 'deposit': return 'Deposit received'
      case 'roi': return 'Daily ROI credited'
      case 'referral': return 'Referral bonus'
      case 'withdraw': return 'Withdrawal processed'
      default: return type
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
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
        {/* Balance Trend Chart */}
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-orange-500" />
              Balance Trend
            </CardTitle>
            <CardDescription className="text-white/50">
              Your wallet balance over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {balanceHistory.length > 0 ? (
              <ChartContainer config={balanceConfig} className="h-[200px] w-full">
                <AreaChart data={balanceHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${formatINR(value)}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#balanceGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-white/40">
                No balance data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Earnings Chart */}
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Monthly Earnings
            </CardTitle>
            <CardDescription className="text-white/50">
              ROI vs Referral income comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyEarnings.length > 0 ? (
              <>
                <ChartContainer config={earningsConfig} className="h-[200px] w-full">
                  <BarChart data={monthlyEarnings} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="roi" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="referral" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-orange-500" />
                    <span className="text-xs text-white/70">ROI Income</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-blue-500" />
                    <span className="text-xs text-white/70">Referral Income</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-white/40">
                No earnings data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Distribution & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Portfolio Distribution */}
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-orange-500" />
              Portfolio Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioData.some((d) => d.value > 0) ? (
              <>
                <div className="flex justify-center">
                  <PieChart width={180} height={180}>
                    <Pie
                      data={portfolioData.filter((d) => d.value > 0)}
                      cx={90}
                      cy={90}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {portfolioData.filter((d) => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {portfolioData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-white/70 truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-white/40">
                No portfolio data yet
              </div>
            )}
          </CardContent>
        </Card>

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
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full',
                          activity.type === 'withdraw'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-green-500/20 text-green-500'
                        )}
                      >
                        {activity.type === 'withdraw' ? (
                          <ArrowDownRight className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">
                          {formatActivityDescription(activity.type)}
                        </p>
                        <p className="text-xs text-white/50">{timeAgo(activity.createdAt)}</p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'font-semibold text-sm',
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
