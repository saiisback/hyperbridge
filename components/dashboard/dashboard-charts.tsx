'use client'

import { Wallet, TrendingUp, IndianRupee } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatINR } from '@/lib/utils'

const earningsConfig = {
  roi: { label: 'ROI Income', color: '#f97316' },
  referral: { label: 'Referral Income', color: '#3b82f6' },
}

const balanceConfig = {
  balance: { label: 'Balance', color: '#f97316' },
}

interface BalanceTrendChartProps {
  data: { day: string; balance: number }[]
}

export function BalanceTrendChart({ data }: BalanceTrendChartProps) {
  return (
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
        {data.length > 0 ? (
          <ChartContainer config={balanceConfig} className="h-[200px] w-full">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
  )
}

interface EarningsChartProps {
  data: { month: string; roi: number; referral: number }[]
}

export function EarningsChart({ data }: EarningsChartProps) {
  return (
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
        {data.length > 0 ? (
          <>
            <ChartContainer config={earningsConfig} className="h-[200px] w-full">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
  )
}

interface PortfolioChartProps {
  data: { name: string; value: number; color: string }[]
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-orange-500" />
          Portfolio Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.some((d) => d.value > 0) ? (
          <>
            <div className="flex justify-center">
              <PieChart width={180} height={180}>
                <Pie
                  data={data.filter((d) => d.value > 0)}
                  cx={90}
                  cy={90}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.filter((d) => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {data.map((item) => (
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
  )
}
