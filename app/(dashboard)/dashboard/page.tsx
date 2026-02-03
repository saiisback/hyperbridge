'use client'

import { Wallet, TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useWallet } from '@/hooks/use-wallet'
import { cn } from '@/lib/utils'

const stats = [
  {
    title: 'Total Balance',
    value: '$12,450.00',
    change: '+12.5%',
    changeType: 'positive' as const,
    icon: Wallet,
  },
  {
    title: 'ROI Income',
    value: '$2,340.00',
    change: '+8.2%',
    changeType: 'positive' as const,
    icon: TrendingUp,
  },
  {
    title: 'Referral Income',
    value: '$890.00',
    change: '+15.3%',
    changeType: 'positive' as const,
    icon: DollarSign,
  },
  {
    title: 'Team Size',
    value: '48',
    change: '+5',
    changeType: 'positive' as const,
    icon: Users,
  },
]

const recentActivities = [
  {
    id: 1,
    type: 'deposit',
    amount: '+$500.00',
    description: 'Deposit received',
    time: '2 hours ago',
    status: 'completed',
  },
  {
    id: 2,
    type: 'roi',
    amount: '+$45.00',
    description: 'Daily ROI credited',
    time: '5 hours ago',
    status: 'completed',
  },
  {
    id: 3,
    type: 'referral',
    amount: '+$25.00',
    description: 'Referral bonus from Level 1',
    time: '1 day ago',
    status: 'completed',
  },
  {
    id: 4,
    type: 'withdrawal',
    amount: '-$200.00',
    description: 'Withdrawal processed',
    time: '2 days ago',
    status: 'completed',
  },
]

// Chart data
const earningsData = [
  { month: 'Jan', roi: 420, referral: 180 },
  { month: 'Feb', roi: 380, referral: 220 },
  { month: 'Mar', roi: 520, referral: 280 },
  { month: 'Apr', roi: 480, referral: 320 },
  { month: 'May', roi: 620, referral: 380 },
  { month: 'Jun', roi: 580, referral: 420 },
  { month: 'Jul', roi: 720, referral: 480 },
]

const balanceData = [
  { day: 'Mon', balance: 10200 },
  { day: 'Tue', balance: 10800 },
  { day: 'Wed', balance: 11200 },
  { day: 'Thu', balance: 10900 },
  { day: 'Fri', balance: 11600 },
  { day: 'Sat', balance: 12100 },
  { day: 'Sun', balance: 12450 },
]

const portfolioData = [
  { name: 'Active Investment', value: 8500, color: '#f97316' },
  { name: 'ROI Earnings', value: 2340, color: '#22c55e' },
  { name: 'Referral Earnings', value: 890, color: '#3b82f6' },
  { name: 'Available', value: 720, color: '#a855f7' },
]

const earningsConfig = {
  roi: { label: 'ROI Income', color: '#f97316' },
  referral: { label: 'Referral Income', color: '#3b82f6' },
}

const balanceConfig = {
  balance: { label: 'Balance', color: '#f97316' },
}

export default function DashboardPage() {
  const { address } = useWallet()

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
              <div className="flex items-center text-xs mt-1">
                {stat.changeType === 'positive' ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span
                  className={cn(
                    stat.changeType === 'positive'
                      ? 'text-green-500'
                      : 'text-red-500'
                  )}
                >
                  {stat.change}
                </span>
                <span className="text-white/50 ml-1">from last month</span>
              </div>
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
            <ChartContainer config={balanceConfig} className="h-[200px] w-full">
              <AreaChart data={balanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
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
            <ChartContainer config={earningsConfig} className="h-[200px] w-full">
              <BarChart data={earningsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
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
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Distribution & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Portfolio Distribution */}
        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              Portfolio Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <PieChart width={180} height={180}>
                <Pie
                  data={portfolioData}
                  cx={90}
                  cy={90}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {portfolioData.map((entry, index) => (
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
                        activity.type === 'withdrawal'
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-green-500/20 text-green-500'
                      )}
                    >
                      {activity.type === 'withdrawal' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">
                        {activity.description}
                      </p>
                      <p className="text-xs text-white/50">{activity.time}</p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      activity.type === 'withdrawal'
                        ? 'text-red-500'
                        : 'text-green-500'
                    )}
                  >
                    {activity.amount}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      
    </div>
  )
}
