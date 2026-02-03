'use client'

import { useState } from 'react'
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShimmerButton } from '@/components/shimmer-button'
import { useWallet } from '@/hooks/use-wallet'

const transactionHistory = [
  {
    id: '1',
    type: 'Deposit',
    amount: '$500.00',
    status: 'completed',
    date: '2024-01-15 14:30',
    txHash: '0x1234...5678',
  },
  {
    id: '2',
    type: 'Withdrawal',
    amount: '$200.00',
    status: 'completed',
    date: '2024-01-14 10:15',
    txHash: '0xabcd...efgh',
  },
  {
    id: '3',
    type: 'Deposit',
    amount: '$1,000.00',
    status: 'pending',
    date: '2024-01-13 09:00',
    txHash: '0x9876...5432',
  },
  {
    id: '4',
    type: 'Withdrawal',
    amount: '$150.00',
    status: 'failed',
    date: '2024-01-12 16:45',
    txHash: '0xijkl...mnop',
  },
]

export default function WalletPage() {
  const { address } = useWallet()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Available Balance</p>
              <p className="text-4xl font-bold text-white mt-2">$12,450.00</p>
              <p className="text-sm text-white/50 mt-1">≈ 4.12 ETH</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
              <Wallet className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="deposit" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger
            value="deposit"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Deposit Tab */}
        <TabsContent value="deposit">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Deposit Funds</CardTitle>
              <CardDescription className="text-white/50">
                Add funds to your wallet to start investing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="depositAmount" className="text-white/70">
                  Amount (USD)
                </Label>
                <Input
                  id="depositAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Payment Method</Label>
                <Select>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-white/10">
                    <SelectItem value="eth">Ethereum (ETH)</SelectItem>
                    <SelectItem value="usdt">Tether (USDT)</SelectItem>
                    <SelectItem value="usdc">USD Coin (USDC)</SelectItem>
                    <SelectItem value="bnb">BNB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/70 mb-2">Deposit Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-orange-500 font-mono break-all">
                    {address || '0x...'}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-white/70" />
                    )}
                  </button>
                </div>
              </div>

              <ShimmerButton
                shimmerColor="#f97316"
                background="rgba(249, 115, 22, 1)"
                className="w-full text-white"
              >
                Generate Deposit Address
              </ShimmerButton>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdraw Tab */}
        <TabsContent value="withdraw">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Withdraw Funds</CardTitle>
              <CardDescription className="text-white/50">
                Withdraw your earnings to your external wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Available Balance</span>
                  <span className="text-xl font-bold text-white">$12,450.00</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAmount" className="text-white/70">
                  Amount (USD)
                </Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  placeholder="Enter amount to withdraw"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAddress" className="text-white/70">
                  Wallet Address
                </Label>
                <Input
                  id="withdrawAddress"
                  placeholder="Enter destination wallet address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 font-mono"
                />
              </div>

              <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Network Fee</span>
                  <span className="text-white">$2.50</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">You will receive</span>
                  <span className="text-orange-500 font-semibold">
                    ${withdrawAmount ? (parseFloat(withdrawAmount) - 2.5).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              <ShimmerButton
                shimmerColor="#f97316"
                background="rgba(249, 115, 22, 1)"
                className="w-full text-white"
              >
                Withdraw Funds
              </ShimmerButton>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-white">Transaction History</CardTitle>
              <CardDescription className="text-white/50">
                View all your deposits and withdrawals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Type</TableHead>
                    <TableHead className="text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-white/50">Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionHistory.map((tx) => (
                    <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white font-medium">{tx.type}</TableCell>
                      <TableCell
                        className={
                          tx.type === 'Deposit' ? 'text-green-500' : 'text-red-500'
                        }
                      >
                        {tx.type === 'Deposit' ? '+' : '-'}{tx.amount}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-white/70">{tx.date}</TableCell>
                      <TableCell className="font-mono text-orange-500">{tx.txHash}</TableCell>
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
