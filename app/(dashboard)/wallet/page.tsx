'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useWallets } from '@privy-io/react-auth'
import { parseEther } from 'viem'

// Platform deposit address on Sepolia
const PLATFORM_DEPOSIT_ADDRESS = '0x531dB6ca6baE892b191f7F9122beA32F228fbee1'
const SEPOLIA_CHAIN_ID = 11155111

interface Transaction {
  id: string
  type: string
  amount: string
  status: string
  date: string
  txHash: string | null
  walletAddress: string | null
}

export default function WalletPage() {
  const { address } = useWallet()
  const { user, refreshUser } = useAuth()
  const { wallets } = useWallets()
  const { toast } = useToast()
  
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  // Get balance from profile
  const availableBalance = user.profile?.availableBalance 
    ? parseFloat(user.profile.availableBalance.toString()) 
    : 0

  // Format balance for display (ETH value)
  const formattedBalance = availableBalance.toFixed(6)

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user.privyId) return

    setIsLoadingTransactions(true)
    try {
      const response = await fetch(`/api/wallet/transactions?privyId=${user.privyId}`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [user.privyId])

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const copyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_DEPOSIT_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid deposit amount',
        variant: 'destructive',
      })
      return
    }

    if (!wallets.length) {
      toast({
        title: 'No wallet connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      })
      return
    }

    const activeWallet = wallets[0]
    
    setIsDepositing(true)
    try {
      // Switch to Sepolia if needed
      try {
        await activeWallet.switchChain(SEPOLIA_CHAIN_ID)
      } catch (switchError) {
        console.log('Chain switch error (may already be on Sepolia):', switchError)
      }

      // Get the provider from the wallet
      const provider = await activeWallet.getEthersProvider()
      const signer = provider.getSigner()

      // Send transaction
      toast({
        title: 'Confirm transaction',
        description: 'Please confirm the transaction in your wallet',
      })

      const tx = await signer.sendTransaction({
        to: PLATFORM_DEPOSIT_ADDRESS,
        value: parseEther(depositAmount),
      })

      toast({
        title: 'Transaction sent',
        description: 'Waiting for confirmation...',
      })

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      if (receipt.status === 1) {
        // Call our API to record the deposit
        const response = await fetch('/api/wallet/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyId: user.privyId,
            txHash: receipt.transactionHash,
            amount: depositAmount,
            walletAddress: activeWallet.address,
          }),
        })

        if (response.ok) {
          toast({
            title: 'Deposit successful',
            description: `${depositAmount} ETH has been added to your balance`,
          })
          setDepositAmount('')
          // Refresh user data to update balance
          await refreshUser()
          // Refresh transactions
          await fetchTransactions()
        } else {
          const errorData = await response.json()
          toast({
            title: 'Deposit recording failed',
            description: errorData.error || 'Failed to record deposit',
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: 'Transaction failed',
          description: 'The transaction was not successful',
          variant: 'destructive',
        })
      }
    } catch (error: unknown) {
      console.error('Deposit error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process deposit'
      toast({
        title: 'Deposit failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsDepositing(false)
    }
  }

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid withdrawal amount',
        variant: 'destructive',
      })
      return
    }

    if (!withdrawAddress) {
      toast({
        title: 'Missing address',
        description: 'Please enter a destination wallet address',
        variant: 'destructive',
      })
      return
    }

    if (parseFloat(withdrawAmount) > availableBalance) {
      toast({
        title: 'Insufficient balance',
        description: 'You do not have enough balance for this withdrawal',
        variant: 'destructive',
      })
      return
    }

    setIsWithdrawing(true)
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: user.privyId,
          amount: withdrawAmount,
          walletAddress: withdrawAddress,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Withdrawal request submitted',
          description: 'Your withdrawal request is pending admin approval. This may take 24-48 hours.',
        })
        setWithdrawAmount('')
        setWithdrawAddress('')
        await refreshUser()
        await fetchTransactions()
      } else {
        const errorData = await response.json()
        toast({
          title: 'Withdrawal failed',
          description: errorData.error || 'Failed to process withdrawal',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Withdrawal error:', error)
      toast({
        title: 'Withdrawal failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsWithdrawing(false)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const truncateTxHash = (hash: string | null) => {
    if (!hash) return '-'
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Available Balance</p>
              <p className="text-4xl font-bold text-white mt-2">{formattedBalance} ETH</p>
              <p className="text-sm text-white/50 mt-1">Sepolia Testnet</p>
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
                Send ETH from your connected wallet to add funds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="depositAmount" className="text-white/70">
                  Amount (ETH)
                </Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Enter amount in ETH"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                  disabled={isDepositing}
                />
              </div>

              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/70 mb-2">Platform Deposit Address (Sepolia)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-orange-500 font-mono break-all">
                    {PLATFORM_DEPOSIT_ADDRESS}
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

              {address && (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <p className="text-sm text-white/70 mb-1">Your Connected Wallet</p>
                  <code className="text-sm text-white font-mono break-all">{address}</code>
                </div>
              )}

              <ShimmerButton
                shimmerColor="#f97316"
                background="rgba(249, 115, 22, 1)"
                className="w-full text-white"
                onClick={handleDeposit}
                disabled={isDepositing || !address}
              >
                {isDepositing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Deposit ETH'
                )}
              </ShimmerButton>

              {!address && (
                <p className="text-sm text-yellow-500 text-center">
                  Please connect your wallet to make a deposit
                </p>
              )}
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
                  <span className="text-xl font-bold text-white">{formattedBalance} ETH</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAmount" className="text-white/70">
                  Amount (ETH)
                </Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  step="0.001"
                  min="0"
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
                  <span className="text-white/50">Network Fee (estimated)</span>
                  <span className="text-white">~0.001 ETH</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">You will receive</span>
                  <span className="text-orange-500 font-semibold">
                    {withdrawAmount ? Math.max(0, parseFloat(withdrawAmount) - 0.001).toFixed(6) : '0.000000'} ETH
                  </span>
                </div>
              </div>

              <ShimmerButton
                shimmerColor="#f97316"
                background="rgba(249, 115, 22, 1)"
                className="w-full text-white"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Withdraw Funds'
                )}
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
              {isLoadingTransactions ? (
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
                      <TableHead className="text-white/50">Amount</TableHead>
                      <TableHead className="text-white/50">Status</TableHead>
                      <TableHead className="text-white/50">Date</TableHead>
                      <TableHead className="text-white/50">Tx Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white font-medium capitalize">{tx.type}</TableCell>
                        <TableCell
                          className={
                            tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'
                          }
                        >
                          {tx.type === 'deposit' ? '+' : '-'}{parseFloat(tx.amount).toFixed(6)} ETH
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
                              {truncateTxHash(tx.txHash)}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
