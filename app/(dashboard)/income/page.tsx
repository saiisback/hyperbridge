'use client'

import { useState } from 'react'
import { TrendingUp, Users, Copy, Check, Calendar, DollarSign } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWallet } from '@/hooks/use-wallet'

const roiHistory = [
  { date: '2024-01-15', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-14', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-13', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-12', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-11', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-10', amount: '$45.00', percentage: '1.5%', status: 'credited' },
  { date: '2024-01-09', amount: '$45.00', percentage: '1.5%', status: 'credited' },
]

const referralEarnings = [
  { level: 1, members: 12, percentage: '10%', earnings: '$520.00' },
  { level: 2, members: 24, percentage: '5%', earnings: '$280.00' },
  { level: 3, members: 12, percentage: '2%', earnings: '$90.00' },
]

const referralHistory = [
  { date: '2024-01-15', from: '0x1234...5678', level: 1, amount: '$50.00' },
  { date: '2024-01-14', from: '0xabcd...efgh', level: 1, amount: '$25.00' },
  { date: '2024-01-13', from: '0x9876...5432', level: 2, amount: '$12.50' },
  { date: '2024-01-12', from: '0xijkl...mnop', level: 1, amount: '$50.00' },
  { date: '2024-01-11', from: '0xqrst...uvwx', level: 3, amount: '$5.00' },
]

export default function IncomePage() {
  const { address } = useWallet()
  const [copied, setCopied] = useState(false)

  const referralLink = address
    ? `https://hyperbridge.io/ref/${address.slice(0, 8)}`
    : 'Connect wallet to get your referral link'

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Income Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-sm border-green-500/30 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total ROI Income</p>
                <p className="text-3xl font-bold text-white mt-2">$2,340.00</p>
                <p className="text-sm text-green-500 mt-1">+$45.00 today</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
                <TrendingUp className="h-7 w-7 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total Referral Income</p>
                <p className="text-3xl font-bold text-white mt-2">$890.00</p>
                <p className="text-sm text-orange-500 mt-1">48 team members</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
                <Users className="h-7 w-7 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roi" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger
            value="roi"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            ROI Income
          </TabsTrigger>
          <TabsTrigger
            value="referral"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Referral Income
          </TabsTrigger>
        </TabsList>

        {/* ROI Income Tab */}
        <TabsContent value="roi" className="space-y-6">
          {/* ROI Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Investment</p>
                    <p className="text-xl font-bold text-white">$3,000.00</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Daily ROI</p>
                    <p className="text-xl font-bold text-white">1.5%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <Calendar className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Days Active</p>
                    <p className="text-xl font-bold text-white">52 Days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ROI History Table */}
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Daily ROI Breakdown</CardTitle>
              <CardDescription className="text-white/50">
                Your daily ROI earnings history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Percentage</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roiHistory.map((row, index) => (
                    <TableRow key={index} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white/70">{row.date}</TableCell>
                      <TableCell className="text-green-500 font-medium">+{row.amount}</TableCell>
                      <TableCell className="text-white">{row.percentage}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral Income Tab */}
        <TabsContent value="referral" className="space-y-6">
          {/* Referral Link */}
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Your Referral Link</CardTitle>
              <CardDescription className="text-white/50">
                Share this link to earn referral commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-4 rounded-lg bg-white/5 border border-white/10">
                <code className="flex-1 text-sm text-orange-500 font-mono break-all">
                  {referralLink}
                </code>
                <button
                  onClick={copyReferralLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Earnings by Level */}
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Earnings by Level</CardTitle>
              <CardDescription className="text-white/50">
                Your commission earnings from each referral level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {referralEarnings.map((level) => (
                  <div
                    key={level.level}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge
                        className={`
                          ${level.level === 1 ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' : ''}
                          ${level.level === 2 ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' : ''}
                          ${level.level === 3 ? 'bg-purple-500/20 text-purple-500 border-purple-500/50' : ''}
                        `}
                      >
                        Level {level.level}
                      </Badge>
                      <span className="text-white/50 text-sm">{level.percentage}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{level.earnings}</p>
                    <p className="text-sm text-white/50 mt-1">{level.members} members</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Referral History */}
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Recent Referral Earnings</CardTitle>
              <CardDescription className="text-white/50">
                Your latest referral commission history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-white/50">From</TableHead>
                    <TableHead className="text-white/50">Level</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralHistory.map((row, index) => (
                    <TableRow key={index} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white/70">{row.date}</TableCell>
                      <TableCell className="font-mono text-orange-500">{row.from}</TableCell>
                      <TableCell>
                        <Badge
                          className={`
                            ${row.level === 1 ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' : ''}
                            ${row.level === 2 ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' : ''}
                            ${row.level === 3 ? 'bg-purple-500/20 text-purple-500 border-purple-500/50' : ''}
                          `}
                        >
                          Level {row.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-green-500 font-medium">+{row.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
