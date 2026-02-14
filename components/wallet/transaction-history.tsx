'use client'

import { Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR, formatDate, truncateHash } from '@/lib/utils'

interface Transaction {
  id: string
  type: string
  amount: string
  amountInr: string | null
  conversionRate: string | null
  token: string | null
  status: string
  date: string
  txHash: string | null
  walletAddress: string | null
  metadata?: { token?: string; priceFetchedAt?: string }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Completed</Badge>
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">Pending</Badge>
    case 'failed':
      return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">Failed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getTransactionToken(tx: Transaction): string {
  return tx.token || tx.metadata?.token || 'USDT'
}

interface TransactionHistoryProps {
  transactions: Transaction[]
  isLoading: boolean
}

export type { Transaction }

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Transaction History</CardTitle>
        <CardDescription className="text-white/50">
          View all your deposits and withdrawals
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            No transactions yet. Make your first deposit to get started!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/50">Type</TableHead>
                <TableHead className="text-white/50">Crypto</TableHead>
                <TableHead className="text-white/50">INR Value</TableHead>
                <TableHead className="text-white/50">Rate</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
                <TableHead className="text-white/50">Date</TableHead>
                <TableHead className="text-white/50">Tx Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="text-white font-medium capitalize">{tx.type}</TableCell>
                  <TableCell className="text-white/70">
                    {parseFloat(tx.amount).toFixed(6)} {getTransactionToken(tx)}
                  </TableCell>
                  <TableCell
                    className={
                      tx.type === 'withdrawal' ? 'text-red-500' : 'text-green-500'
                    }
                  >
                    {tx.type === 'withdrawal' ? '-' : '+'}₹
                    {tx.amountInr
                      ? formatINR(parseFloat(tx.amountInr))
                      : formatINR(parseFloat(tx.amount))}
                  </TableCell>
                  <TableCell className="text-white/50 text-xs">
                    {tx.conversionRate
                      ? `1 ${getTransactionToken(tx)} = ₹${parseFloat(tx.conversionRate).toLocaleString('en-IN')}`
                      : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                  <TableCell className="text-white/70">{formatDate(tx.date)}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
