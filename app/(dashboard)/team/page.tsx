'use client'

import { useState, useEffect } from 'react'
import { Users, Copy, Check, UserPlus, TrendingUp, Loader2 } from 'lucide-react'
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

interface TeamMember {
  address: string
  joinDate: string
  investment: number
  status: string
}

interface TeamData {
  levels: Record<number, TeamMember[]>
  counts: {
    level1: number
    level2: number
    level3: number
    total: number
  }
  referralCode: string | null
}

export default function TeamPage() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user.privyId) return

    const fetchTeam = async () => {
      try {
        const res = await fetch(`/api/team?privyId=${user.privyId}`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (error) {
        console.error('Failed to fetch team data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeam()
  }, [user.privyId])

  const referralLink = data?.referralCode
    ? `${window.location.origin}/ref/${data.referralCode}`
    : 'No referral code available'

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

  const renderTeamTable = (members: TeamMember[]) => {
    if (members.length === 0) {
      return (
        <div className="py-8 text-center text-white/40">
          No members at this level yet
        </div>
      )
    }

    return (
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
              <TableCell className="text-white font-medium">
                {member.investment.toFixed(4)} ETH
              </TableCell>
              <TableCell>{getStatusBadge(member.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const level1 = data?.levels[1] ?? []
  const level2 = data?.levels[2] ?? []
  const level3 = data?.levels[3] ?? []
  const counts = data?.counts ?? { level1: 0, level2: 0, level3: 0, total: 0 }

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
                <p className="text-2xl font-bold text-white">{counts.total}</p>
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
                <p className="text-2xl font-bold text-white">{counts.level1}</p>
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
                <p className="text-2xl font-bold text-white">{counts.level2}</p>
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
                <p className="text-2xl font-bold text-white">{counts.level3}</p>
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
            Level 1 ({counts.level1})
          </TabsTrigger>
          <TabsTrigger
            value="level2"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Level 2 ({counts.level2})
          </TabsTrigger>
          <TabsTrigger
            value="level3"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            Level 3 ({counts.level3})
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
            <CardContent>{renderTeamTable(level1)}</CardContent>
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
            <CardContent>{renderTeamTable(level2)}</CardContent>
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
            <CardContent>{renderTeamTable(level3)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
