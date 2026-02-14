'use client'

import { useEffect, useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useAdminData } from '@/hooks/use-admin-data'
import { formatINR, truncateHash } from '@/lib/utils'

interface Transaction {
  id: string
  type: string
  amount: string
  amountInr: string | null
  conversionRate: string | null
  token: string | null
  status: string
  txHash: string | null
  walletAddress: string | null
  createdAt: string
  user: { name: string | null; email: string | null; primaryWallet: string | null }
}

export default function AdminTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const extraParams: Record<string, string> = {}
  if (typeFilter !== 'all') extraParams.type = typeFilter
  if (statusFilter !== 'all') extraParams.status = statusFilter

  const { data: transactions, isLoading, page, totalPages, total, setPage } =
    useAdminData<Transaction>('/api/admin/transactions', 'transactions', {
      extraParams: Object.keys(extraParams).length > 0 ? extraParams : undefined,
    })

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, setPage])

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-white">Transactions ({total})</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-white/10">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdraw">Withdraw</SelectItem>
                  <SelectItem value="roi">ROI</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-white/10">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-white/50 text-center py-8">No transactions found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">User</TableHead>
                    <TableHead className="text-white/50">Type</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-white/50">Tx Hash</TableHead>
                    <TableHead className="text-white/50">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">
                        {tx.user.name || tx.user.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-white capitalize">{tx.type}</TableCell>
                      <TableCell
                        className={tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}
                      >
                        {tx.type === 'deposit' ? '+' : '-'}
                        ₹{formatINR(parseFloat(tx.amountInr || tx.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tx.status === 'completed'
                              ? 'bg-green-500/20 text-green-500 border-green-500/50'
                              : tx.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                              : 'bg-red-500/20 text-red-500 border-red-500/50'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-orange-500 hover:text-orange-400 flex items-center gap-1"
                          >
                            {truncateHash(tx.txHash)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-white/50">
                    Page {page} of {totalPages}
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
        </CardContent>
      </Card>
    </div>
  )
}
