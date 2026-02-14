'use client'

import { useEffect, useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { useAdminData } from '@/hooks/use-admin-data'
import { useToast } from '@/hooks/use-toast'
import { formatINR, truncateAddress } from '@/lib/utils'

interface Withdrawal {
  id: string
  amount: string
  amountInr: string | null
  status: string
  walletAddress: string | null
  metadata: Record<string, unknown>
  createdAt: string
  user: { name: string | null; email: string | null; primaryWallet: string | null }
}

export default function AdminWithdrawalsPage() {
  const { user, getAccessToken } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('pending')

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const { data: withdrawals, isLoading, page, totalPages, total, setPage, refetch } =
    useAdminData<Withdrawal>('/api/admin/withdrawals', 'withdrawals', {
      extraParams: { status: activeTab },
    })

  useEffect(() => {
    setPage(1)
  }, [activeTab, setPage])

  const handleApprove = async (id: string) => {
    if (!user.privyId) return
    setIsProcessing(true)
    setApprovingId(id)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch(`/api/admin/withdrawals/${id}/approve`, accessToken, {
        method: 'POST',
      })
      if (res.ok) {
        toast({ title: 'Withdrawal approved', description: 'The withdrawal has been approved successfully.' })
        refetch()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve withdrawal', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!user.privyId || !rejectingId) return
    setIsProcessing(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch(`/api/admin/withdrawals/${rejectingId}/reject`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (res.ok) {
        toast({ title: 'Withdrawal rejected', description: 'The withdrawal has been rejected and balance refunded.' })
        setRejectDialogOpen(false)
        setRejectingId(null)
        setRejectReason('')
        refetch()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reject withdrawal', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const openRejectDialog = (id: string) => {
    setRejectingId(id)
    setRejectReason('')
    setRejectDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white/5 border border-white/10 mb-6">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white"
              >
                Pending
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
              >
                Completed
              </TabsTrigger>
              <TabsTrigger
                value="failed"
                className="data-[state=active]:bg-red-500 data-[state=active]:text-white"
              >
                Rejected
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                </div>
              ) : withdrawals.length === 0 ? (
                <p className="text-white/50 text-center py-8">
                  No {activeTab} withdrawals
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-white/50">User</TableHead>
                          <TableHead className="text-white/50">Amount</TableHead>
                          <TableHead className="text-white/50 hidden sm:table-cell">Destination</TableHead>
                          <TableHead className="text-white/50">Status</TableHead>
                          <TableHead className="text-white/50 hidden sm:table-cell">Date</TableHead>
                          {activeTab === 'pending' && (
                            <TableHead className="text-white/50">Actions</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((w) => (
                          <TableRow key={w.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="text-white">
                              {w.user.name || w.user.email || 'Unknown'}
                            </TableCell>
                            <TableCell className="text-red-500 font-medium">
                              ₹{formatINR(parseFloat(w.amountInr || w.amount))}
                            </TableCell>
                            <TableCell className="text-white/70 font-mono hidden sm:table-cell">
                              {w.walletAddress ? truncateAddress(w.walletAddress) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  w.status === 'completed'
                                    ? 'bg-green-500/20 text-green-500 border-green-500/50'
                                    : w.status === 'pending'
                                    ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                                    : 'bg-red-500/20 text-red-500 border-red-500/50'
                                }
                              >
                                {w.status === 'failed' ? 'Rejected' : w.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white/70 hidden sm:table-cell">
                              {new Date(w.createdAt).toLocaleString()}
                            </TableCell>
                            {activeTab === 'pending' && (
                              <TableCell>
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(w.id)}
                                    disabled={isProcessing}
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-3"
                                  >
                                    {approvingId === w.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 sm:mr-1" />
                                        <span className="hidden sm:inline">Approve</span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRejectDialog(w.id)}
                                    disabled={isProcessing}
                                    className="border-red-500/50 text-red-500 hover:bg-red-500/10 px-2 sm:px-3"
                                  >
                                    <XCircle className="h-4 w-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Reject</span>
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-white/50">
                        Page {page} of {totalPages} ({total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="border-white/10 text-white/70 hover:bg-white/10"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="border-white/10 text-white/70 hover:bg-white/10"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-black/95 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Withdrawal</DialogTitle>
            <DialogDescription className="text-white/50">
              This will reject the withdrawal and refund the user&apos;s balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-white/70">
                Reason (optional)
              </Label>
              <Input
                id="reason"
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              className="border-white/10 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Confirm Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
