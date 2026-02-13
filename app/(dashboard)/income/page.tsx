'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Copy, Check, Calendar, IndianRupee, Loader2 } from 'lucide-react'
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
import { useAuth } from '@/context/auth-context'
import { formatINR } from '@/lib/utils'
import { authFetch } from '@/lib/api'

interface IncomeData {
  totalRoiIncome: number
  todayRoi: number
  totalInvested: number
  dailyRoiRate: number
  daysActive: number
  roiHistory: { date: string; amount: number; percentage: string; status: string }[]
  totalReferralIncome: number
  directMembers: number
  directEarnings: number
  referralHistory: { date: string; from: string; amount: number }[]
  referralCode: string | null
}

function formatAmount(value: number): string {
  return formatINR(value)
}

export default function IncomePage() {
  const { user, getAccessToken } = useAuth()
  const [copied, setCopied] = useState(false)
  const [data, setData] = useState<IncomeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user.privyId) return

    const fetchIncome = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return
        const res = await authFetch('/api/income', accessToken)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (error) {
        console.error('Failed to fetch income data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncome()
  }, [user.privyId, getAccessToken])

  const referralLink = data?.referralCode
    ? `${window.location.origin}/ref/${data.referralCode}`
    : 'No referral code available'

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
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
                <p className="text-3xl font-bold text-white mt-2">
                  ₹{formatAmount(data?.totalRoiIncome ?? 0)}
                </p>
                <p className="text-sm text-green-500 mt-1">
                  +₹{formatAmount(data?.todayRoi ?? 0)} today
                </p>
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
                <p className="text-3xl font-bold text-white mt-2">
                  ₹{formatAmount(data?.totalReferralIncome ?? 0)}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
                <IndianRupee className="h-7 w-7 text-orange-500" />
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
            <IndianRupee className="h-4 w-4 mr-2" />
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
                    <IndianRupee className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Investment</p>
                    <p className="text-xl font-bold text-white">
                      ₹{formatAmount(data?.totalInvested ?? 0)}
                    </p>
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
                    <p className="text-xl font-bold text-white">
                      {data?.dailyRoiRate ?? 0.5}%
                    </p>
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
                    <p className="text-xl font-bold text-white">
                      {data?.daysActive ?? 0} Days
                    </p>
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
              {(data?.roiHistory ?? []).length > 0 ? (
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
                    {(data?.roiHistory ?? []).map((row, index) => (
                      <TableRow key={index} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white/70">{row.date}</TableCell>
                        <TableCell className="text-green-500 font-medium">
                          +₹{formatAmount(row.amount)}
                        </TableCell>
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
              ) : (
                <div className="py-8 text-center text-white/40">
                  No ROI history yet. Make a deposit to start earning daily ROI.
                </div>
              )}
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

          {/* Direct Referral Stats */}
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Direct Referral Stats</CardTitle>
              <CardDescription className="text-white/50">
                You earn 10% commission on every deposit from your referrals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-white/50 mb-1">Referred Members</p>
                  <p className="text-2xl font-bold text-white">{data?.directMembers ?? 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-white/50 mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-500">
                    ₹{formatAmount(data?.directEarnings ?? 0)}
                  </p>
                </div>
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
              {(data?.referralHistory ?? []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">Date</TableHead>
                      <TableHead className="text-white/50">From</TableHead>
                      <TableHead className="text-white/50">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.referralHistory ?? []).map((row, index) => (
                      <TableRow key={index} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white/70">{row.date}</TableCell>
                        <TableCell className="font-mono text-orange-500">{row.from}</TableCell>
                        <TableCell className="text-green-500 font-medium">
                          +₹{formatAmount(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-white/40">
                  No referral earnings yet. Share your referral link to start earning.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
