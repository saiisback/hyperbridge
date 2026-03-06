'use client'

import { useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useWallets } from '@privy-io/react-auth'
import {
  parseEther,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
} from 'viem'
import type { Chain } from 'viem'
import { mainnet, bsc, polygon, base, arbitrum } from 'viem/chains'

interface Withdrawal {
  id: string
  amount: string
  amountInr: string | null
  token: string | null
  status: string
  walletAddress: string | null
  metadata: Record<string, unknown>
  createdAt: string
  user: { name: string | null; email: string | null; primaryWallet: string | null }
}

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  8453: base,
  42161: arbitrum,
}

const ERC20_TOKENS: Record<number, Record<string, { address: `0x${string}`; decimals: number }>> = {
  1: {
    USDT: {
      address: (process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '') as `0x${string}`,
      decimals: 6,
    },
  },
  56: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`,
      decimals: 18,
    },
  },
}

function TableSkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <Skeleton className="h-4 w-20 bg-white/10" />
          <Skeleton className="h-4 w-28 bg-white/10 hidden sm:block" />
          <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
          <Skeleton className="h-4 w-28 bg-white/10 hidden sm:block" />
        </div>
      ))}
    </div>
  )
}

export default function AdminWithdrawalsPage() {
  const { user, getAccessToken } = useAuth()
  const { toast } = useToast()
  const { wallets } = useWallets()
  const [activeTab, setActiveTab] = useState('pending')

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveStatus, setApproveStatus] = useState<string | null>(null)

  const adminWallet = wallets.find(
    (w) => w.walletClientType !== 'privy'
  ) || wallets[0] || null

  const { data: withdrawals, isLoading, isFetching, page, totalPages, total, setPage, refetch } =
    useAdminData<Withdrawal>('/api/admin/withdrawals', 'withdrawals', {
      extraParams: { status: activeTab },
    })

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!user.privyId) return

    if (!adminWallet) {
      toast({
        title: 'No wallet connected',
        description: 'Please connect a wallet (e.g. MetaMask) to approve withdrawals.',
        variant: 'destructive',
      })
      return
    }

    if (!withdrawal.walletAddress) {
      toast({ title: 'Error', description: 'No destination address on this withdrawal', variant: 'destructive' })
      return
    }

    setIsProcessing(true)
    setApprovingId(withdrawal.id)
    setApproveStatus('Preparing transaction...')

    try {
      const token = withdrawal.token || 'USDT'
      const meta = withdrawal.metadata
      const netAmount = meta?.netAmount
        ? String(meta.netAmount)
        : (Number(withdrawal.amount) * 0.9).toFixed(6)
      const destinationAddress = withdrawal.walletAddress as `0x${string}`
      const chainId = (meta?.chainId as number) || 1
      const chain = CHAIN_MAP[chainId] || mainnet

      const ethereumProvider = await adminWallet.getEthereumProvider()

      // Switch chain if needed
      try {
        await ethereumProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chain.id.toString(16)}` }],
        })
      } catch (switchError: unknown) {
        // Chain not added to wallet — try adding it
        if (switchError && typeof switchError === 'object' && 'code' in switchError && (switchError as { code: number }).code === 4902) {
          try {
            await ethereumProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${chain.id.toString(16)}`,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.default.http[0]],
                blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
              }],
            })
          } catch {
            toast({ title: 'Error', description: `Please add and switch to ${chain.name} in your wallet`, variant: 'destructive' })
            return
          }
        } else {
          toast({ title: 'Error', description: `Please switch your wallet to ${chain.name}`, variant: 'destructive' })
          return
        }
      }

      // Get accounts from provider
      const accounts = await ethereumProvider.request({ method: 'eth_accounts' }) as string[]
      const account = accounts[0] as `0x${string}` | undefined
      if (!account) {
        toast({ title: 'Error', description: 'Could not get wallet address', variant: 'destructive' })
        return
      }

      setApproveStatus('Waiting for wallet confirmation...')

      let txHash: `0x${string}`

      if (token === 'ETH') {
        txHash = await ethereumProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: destinationAddress,
            value: `0x${parseEther(netAmount).toString(16)}`,
          }],
        }) as `0x${string}`
      } else {
        const tokenConfig = ERC20_TOKENS[chainId]?.[token]
        if (!tokenConfig || !tokenConfig.address) {
          toast({ title: 'Error', description: `Unsupported token: ${token} on chain ${chainId}`, variant: 'destructive' })
          return
        }

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [destinationAddress, parseUnits(netAmount, tokenConfig.decimals)],
        })

        txHash = await ethereumProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: tokenConfig.address,
            data,
          }],
        }) as `0x${string}`
      }

      setApproveStatus('Recording transaction...')

      // POST txHash to the API
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const res = await adminFetch(`/api/admin/withdrawals/${withdrawal.id}/approve`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ txHash }),
      })

      if (res.ok) {
        toast({ title: 'Withdrawal approved', description: `Transaction sent: ${txHash.slice(0, 10)}...` })
        refetch()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (err: unknown) {
      // User rejected the transaction in their wallet
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 4001) {
        toast({ title: 'Transaction cancelled', description: 'You rejected the transaction in your wallet.', variant: 'destructive' })
      } else {
        console.error('Approve error:', err)
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to send transaction',
          variant: 'destructive',
        })
      }
    } finally {
      setIsProcessing(false)
      setApprovingId(null)
      setApproveStatus(null)
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Withdrawals</CardTitle>
            {activeTab === 'pending' && (
              <div className="flex items-center gap-2">
                {adminWallet ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                    <Wallet className="h-3 w-3 mr-1" />
                    {truncateAddress(adminWallet.address)}
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                    <Wallet className="h-3 w-3 mr-1" />
                    No wallet connected
                  </Badge>
                )}
              </div>
            )}
          </div>
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
                <TableSkeletonRows />
              ) : withdrawals.length === 0 ? (
                <p className="text-white/50 text-center py-8">
                  No {activeTab} withdrawals
                </p>
              ) : (
                <div className={isFetching ? 'opacity-60 transition-opacity' : ''}>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-white/50">User</TableHead>
                          <TableHead className="text-white/50">Amount</TableHead>
                          <TableHead className="text-white/50 hidden sm:table-cell">Network</TableHead>
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
                            <TableCell className="text-white/70 hidden sm:table-cell">
                              <Badge className={
                                (w.metadata?.chainId as number) === 56
                                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                  : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                              }>
                                {(w.metadata?.chainId as number) === 56 ? 'BEP-20' : 'ERC-20'}
                              </Badge>
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
                                    onClick={() => handleApprove(w)}
                                    disabled={isProcessing}
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-3"
                                  >
                                    {approvingId === w.id ? (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="hidden sm:inline text-xs">
                                          {approveStatus || 'Processing...'}
                                        </span>
                                      </span>
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
                </div>
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
