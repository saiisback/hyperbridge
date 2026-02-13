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
import { authFetch } from '@/lib/api'
import { createWalletClient, createPublicClient, custom, http, parseEther, parseUnits, erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { formatINR } from '@/lib/utils'

// Platform deposit address on Sepolia
const PLATFORM_DEPOSIT_ADDRESS = '0x531dB6ca6baE892b191f7F9122beA32F228fbee1'
const SEPOLIA_CHAIN_ID = 11155111

// Token configuration (Sepolia testnet)
const TOKENS = {
  ETH: {
    name: 'ETH',
    address: null as null,
    decimals: 18,
  },
  USDT: {
    name: 'USDT',
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' as `0x${string}`,
    decimals: 6,
  },
} as const

// ABI for minting test USDT tokens
const USDT_MINT_ABI = [{
  name: '_giveMeATokens',
  type: 'function',
  inputs: [{ name: 'amount', type: 'uint256' }],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const

type TokenKey = keyof typeof TOKENS

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

export default function WalletPage() {
  const { address } = useWallet()
  const { user, refreshUser, setProfileData, getAccessToken } = useAuth()
  const { wallets } = useWallets()
  const { toast } = useToast()

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [selectedToken, setSelectedToken] = useState<TokenKey>('ETH')
  const [copied, setCopied] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [isMinting, setIsMinting] = useState(false)

  const token = TOKENS[selectedToken]

  // Get balance from profile (stored in INR)
  const availableBalance = user.profile?.availableBalance
    ? parseFloat(user.profile.availableBalance.toString())
    : 0

  const formattedBalance = formatINR(availableBalance)

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user.privyId) return

    setIsLoadingTransactions(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const response = await authFetch('/api/wallet/transactions', accessToken)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [user.privyId, getAccessToken])

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const copyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_DEPOSIT_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Mint test tokens (Sepolia testnet only)
  const handleMintTestTokens = async () => {
    if (selectedToken === 'ETH') {
      toast({
        title: 'Use a faucet for ETH',
        description: 'Get Sepolia ETH from faucet.sepolia.dev or faucets.chain.link/sepolia',
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
    setIsMinting(true)

    try {
      try {
        await activeWallet.switchChain(SEPOLIA_CHAIN_ID)
      } catch {
        // may already be on Sepolia
      }

      const ethereumProvider = await activeWallet.getEthereumProvider()
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(ethereumProvider),
      })
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      })

      const [account] = await walletClient.getAddresses()

      const hash = await walletClient.writeContract({
        account,
        address: TOKENS.USDT.address,
        abi: USDT_MINT_ABI,
        functionName: '_giveMeATokens',
        args: [BigInt(1000 * 10 ** 6)], // 1000 USDT
      })

      await publicClient.waitForTransactionReceipt({ hash })

      toast({
        title: 'Tokens minted!',
        description: '1000 USDT has been added to your wallet',
      })
    } catch (error: unknown) {
      console.error('Mint error:', error)
      const msg = error instanceof Error ? error.message : 'Failed to mint tokens'
      toast({
        title: 'Mint failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsMinting(false)
    }
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

      // Get the EIP-1193 provider from the wallet
      const ethereumProvider = await activeWallet.getEthereumProvider()
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(ethereumProvider),
      })
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      })

      const [account] = await walletClient.getAddresses()

      // Send transaction
      toast({
        title: 'Confirm transaction',
        description: `Please confirm the ${token.name} transfer in your wallet`,
      })

      let hash: `0x${string}`

      if (token.address) {
        // ERC-20 token transfer (USDT)
        hash = await walletClient.writeContract({
          account,
          address: token.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [PLATFORM_DEPOSIT_ADDRESS as `0x${string}`, parseUnits(depositAmount, token.decimals)],
        })
      } else {
        // Native ETH transfer
        hash = await walletClient.sendTransaction({
          account,
          to: PLATFORM_DEPOSIT_ADDRESS as `0x${string}`,
          value: parseEther(depositAmount),
        })
      }

      toast({
        title: 'Transaction sent',
        description: 'Waiting for confirmation...',
      })

      // Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        // Call our API to record the deposit
        const accessToken = await getAccessToken()
        if (!accessToken) throw new Error('Not authenticated')
        const response = await authFetch('/api/wallet/deposit', accessToken, {
          method: 'POST',
          body: JSON.stringify({
            txHash: receipt.transactionHash,
            amount: depositAmount,
            walletAddress: activeWallet.address,
            token: selectedToken,
          }),
        })

        const responseData = await response.json()

        if (response.ok) {
          // Immediately update profile with the data returned from deposit API
          if (responseData.profile) {
            setProfileData(responseData.profile)
          }
          toast({
            title: 'Deposit successful',
            description: `${depositAmount} ${token.name} has been added to your balance`,
          })
          setDepositAmount('')
          await refreshUser()
          await fetchTransactions()
        } else {
          toast({
            title: 'Deposit recording failed',
            description: responseData.error || 'Failed to record deposit',
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
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')
      const response = await authFetch('/api/wallet/withdraw', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: withdrawAmount,
          walletAddress: withdrawAddress,
          token: selectedToken,
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

  const getTransactionToken = (tx: Transaction) => {
    return tx.token || tx.metadata?.token || 'USDT'
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-sm border-orange-500/30 rounded-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Available Balance</p>
              <p className="text-4xl font-bold text-white mt-2">₹{formattedBalance}</p>
              <p className="text-sm text-white/50 mt-1">Sepolia Testnet</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30">
              <Wallet className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Selector */}
      <div className="flex gap-2">
        {(Object.keys(TOKENS) as TokenKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedToken(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedToken === key
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
            }`}
          >
            {TOKENS[key].name}
          </button>
        ))}
      </div>

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
              <CardTitle className="text-white">Deposit {token.name}</CardTitle>
              <CardDescription className="text-white/50">
                Send {token.name} from your connected wallet to add funds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="depositAmount" className="text-white/70">
                  Amount ({token.name})
                </Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Enter amount in ${token.name}`}
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

              {token.address && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-white/70 mb-2">{token.name} Token Contract (Sepolia)</p>
                  <code className="text-sm text-orange-500 font-mono break-all">
                    {token.address}
                  </code>
                </div>
              )}

              {address && (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <p className="text-sm text-white/70 mb-1">Your Connected Wallet</p>
                  <code className="text-sm text-white font-mono break-all">{address}</code>
                </div>
              )}

              {/* Mint test tokens (testnet only) */}
              {token.address && address && (
                <button
                  onClick={handleMintTestTokens}
                  disabled={isMinting}
                  className="w-full py-2 px-4 rounded-lg border border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors text-sm disabled:opacity-50"
                >
                  {isMinting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Minting...
                    </span>
                  ) : (
                    `Mint Test ${token.name} (Sepolia Faucet)`
                  )}
                </button>
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
                  `Deposit ${token.name}`
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
              <CardTitle className="text-white">Withdraw {token.name}</CardTitle>
              <CardDescription className="text-white/50">
                Withdraw your earnings in {token.name} to your external wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Available Balance</span>
                  <span className="text-xl font-bold text-white">₹{formattedBalance}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAmount" className="text-white/70">
                  Amount ({token.name})
                </Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Enter amount in ${token.name}`}
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
                  <span className="text-white/50">You will receive</span>
                  <span className="text-orange-500 font-semibold">
                    {withdrawAmount ? parseFloat(withdrawAmount).toFixed(2) : '0.00'} {token.name}
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
                  `Withdraw ${token.name}`
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
