'use client'

import { useState } from 'react'
import { Users, Copy, Check, UserPlus, TrendingUp } from 'lucide-react'
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

const teamLevel1 = [
  { address: '0x1234...5678', joinDate: '2024-01-10', investment: '$1,000', status: 'active' },
  { address: '0xabcd...efgh', joinDate: '2024-01-09', investment: '$500', status: 'active' },
  { address: '0x9876...5432', joinDate: '2024-01-08', investment: '$2,000', status: 'active' },
  { address: '0xijkl...mnop', joinDate: '2024-01-07', investment: '$750', status: 'active' },
  { address: '0xqrst...uvwx', joinDate: '2024-01-06', investment: '$1,500', status: 'inactive' },
  { address: '0xyzab...cdef', joinDate: '2024-01-05', investment: '$300', status: 'active' },
]

const teamLevel2 = [
  { address: '0x2345...6789', joinDate: '2024-01-11', investment: '$800', status: 'active' },
  { address: '0xbcde...fghi', joinDate: '2024-01-10', investment: '$450', status: 'active' },
  { address: '0x8765...4321', joinDate: '2024-01-09', investment: '$1,200', status: 'active' },
  { address: '0xjklm...nopq', joinDate: '2024-01-08', investment: '$600', status: 'inactive' },
  { address: '0xrstu...vwxy', joinDate: '2024-01-07', investment: '$900', status: 'active' },
]

const teamLevel3 = [
  { address: '0x3456...7890', joinDate: '2024-01-12', investment: '$700', status: 'active' },
  { address: '0xcdef...ghij', joinDate: '2024-01-11', investment: '$350', status: 'active' },
  { address: '0x7654...3210', joinDate: '2024-01-10', investment: '$1,100', status: 'inactive' },
]

export default function TeamPage() {
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

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Active</Badge>
    ) : (
      <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">Inactive</Badge>
    )
  }

  const renderTeamTable = (members: typeof teamLevel1) => (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="text-white/50">Member Address</TableHead>
          <TableHead className="text-white/50">Join Date</TableHead>
          <TableHead className="text-white/50">Investment</TableHead>
          <TableHead className="text-white/50">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member, index) => (
          <TableRow key={index} className="border-white/10 hover:bg-white/5">
            <TableCell className="font-mono text-orange-500">{member.address}</TableCell>
            <TableCell className="text-white/70">{member.joinDate}</TableCell>
            <TableCell className="text-white font-medium">{member.investment}</TableCell>
            <TableCell>{getStatusBadge(member.status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-white/70">Total Team</p>
                <p className="text-2xl font-bold text-white">48</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30">
                <UserPlus className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-white/70">Level 1</p>
                <p className="text-2xl font-bold text-white">12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30">
                <UserPlus className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-white/70">Level 2</p>
                <p className="text-2xl font-bold text-white">24</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
                <UserPlus className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-white/70">Level 3</p>
                <p className="text-2xl font-bold text-white">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Your Referral Link</CardTitle>
          <CardDescription className="text-white/50">
            Share this link to grow your team and earn commissions
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
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-white/70">Level 1: <span className="text-white">10%</span></span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-white/70">Level 2: <span className="text-white">5%</span></span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-white/70">Level 3: <span className="text-white">2%</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Tabs */}
      <Tabs defaultValue="level1" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger
            value="level1"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Level 1 ({teamLevel1.length})
          </TabsTrigger>
          <TabsTrigger
            value="level2"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Level 2 ({teamLevel2.length})
          </TabsTrigger>
          <TabsTrigger
            value="level3"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Level 3 ({teamLevel3.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="level1">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/50">
                  Level 1
                </Badge>
                <CardTitle className="text-white">Direct Referrals</CardTitle>
              </div>
              <CardDescription className="text-white/50">
                Members you directly referred - 10% commission
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTeamTable(teamLevel1)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="level2">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/50">
                  Level 2
                </Badge>
                <CardTitle className="text-white">Second Level</CardTitle>
              </div>
              <CardDescription className="text-white/50">
                Members referred by your Level 1 - 5% commission
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTeamTable(teamLevel2)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="level3">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                  Level 3
                </Badge>
                <CardTitle className="text-white">Third Level</CardTitle>
              </div>
              <CardDescription className="text-white/50">
                Members referred by your Level 2 - 2% commission
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTeamTable(teamLevel3)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
