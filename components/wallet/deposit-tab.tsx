'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Loader2, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShimmerButton } from '@/components/shimmer-button'
import { useAuth } from '@/context/auth-context'
import { useWallet } from '@/hooks/use-wallet'
import { useToast } from '@/hooks/use-toast'
import { useWallets } from '@privy-io/react-auth'
import { authFetch } from '@/lib/api'
import { createPublicClient, http, parseEther, parseUnits, encodeFunctionData, erc20Abi } from 'viem'
import { mainnet } from 'viem/chains'
import type { TokenKey } from './token-selector'
import { TOKENS } from './token-selector'

const PLATFORM_DEPOSIT_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_DEPOSIT_ADDRESS || ''
const TRC20_DEPOSIT_ADDRESS = process.env.NEXT_PUBLIC_TRC20_DEPOSIT_ADDRESS || 'TZA7cFmFFtTsKrVkLqdSPSHpZzD8if189t'
const MIN_DEPOSIT_INR = 50000

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  USDT: 'tether',
  TRX: 'tron',
}

async function getApproxINRValue(tokenName: string, amount: number): Promise<number> {
  const coinId = COINGECKO_IDS[tokenName]
  if (!coinId) return 0
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=inr`)
  if (!res.ok) return 0
  const data = await res.json()
  const rate = data[coinId]?.inr
  return typeof rate === 'number' ? amount * rate : 0
}

interface DepositTabProps {
  selectedToken: TokenKey
  onSuccess: () => Promise<void>
}

function CopyableAddress({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <p className="text-sm text-white/70 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm text-orange-500 font-mono break-all">
          {address}
        </code>
        <button
          onClick={copyToClipboard}
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
  )
}

function TronDepositFlow({ selectedToken, onSuccess }: DepositTabProps) {
  const { refreshUser, setProfileData, getAccessToken } = useAuth()
  const { toast } = useToast()

  const [depositAmount, setDepositAmount] = useState('')
  const [inrEquivalent, setInrEquivalent] = useState<number | null>(null)
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)
  const [step, setStep] = useState<'amount' | 'confirm'>('amount')
  const [senderAddress, setSenderAddress] = useState('')
  const [txHash, setTxHash] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)

  const token = TOKENS[selectedToken]

  // Fetch INR equivalent when amount changes
  useEffect(() => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount <= 0) {
      setInrEquivalent(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsFetchingPrice(true)
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr'
        )
        if (!res.ok) throw new Error('Price fetch failed')
        const data = await res.json()
        const inrRate = data.tether?.inr
        if (typeof inrRate === 'number') {
          setInrEquivalent(amount * inrRate)
        }
      } catch {
        setInrEquivalent(null)
      } finally {
        setIsFetchingPrice(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [depositAmount])

  const handleProceedToConfirm = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid deposit amount', variant: 'destructive' })
      return
    }

    // Check minimum deposit
    const inrValue = await getApproxINRValue('USDT', amount)
    if (inrValue > 0 && inrValue < MIN_DEPOSIT_INR) {
      toast({
        title: 'Below minimum deposit',
        description: `Minimum deposit is ₹50,000. Your deposit is worth approx ₹${inrValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
        variant: 'destructive',
      })
      return
    }

    setSubmittedAt(Date.now())
    setStep('confirm')
  }

  const handleSubmitDeposit = async () => {
    if (!senderAddress.trim()) {
      toast({ title: 'Missing address', description: 'Please enter the TRON address you sent from', variant: 'destructive' })
      return
    }
    if (!txHash.trim()) {
      toast({ title: 'Missing transaction hash', description: 'Please enter the transaction hash', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')

      const response = await authFetch('/api/wallet/deposit-manual', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          txHash: txHash.trim(),
          amount: depositAmount,
          senderAddress: senderAddress.trim(),
          network: 'trc20',
          token: 'USDT',
          submittedAt,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        if (responseData.profile) setProfileData(responseData.profile)
        toast({
          title: 'Deposit submitted',
          description: responseData.message || 'Your TRC-20 deposit has been submitted for verification.',
        })
        setDepositAmount('')
        setSenderAddress('')
        setTxHash('')
        setStep('amount')
        setSubmittedAt(null)
        await refreshUser()
        await onSuccess()
      } else {
        toast({ title: 'Deposit failed', description: responseData.error || 'Failed to submit deposit', variant: 'destructive' })
      }
    } catch (error: unknown) {
      console.error('TRC-20 deposit error:', error)
      toast({ title: 'Deposit failed', description: error instanceof Error ? error.message : 'Failed to process deposit', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Deposit {token.label}</CardTitle>
        <CardDescription className="text-white/50">
          Send USDT via TRON (TRC-20) network
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'amount' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="tronDepositAmount" className="text-white/70">Amount (USDT)</Label>
              <Input
                id="tronDepositAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount in USDT"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
              />
            </div>

            {/* INR Equivalent */}
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/70 mb-1">Equivalent in INR</p>
                {isFetchingPrice ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                    <span className="text-sm text-white/50">Fetching rate...</span>
                  </div>
                ) : inrEquivalent !== null ? (
                  <p className="text-lg font-semibold text-white">
                    ~₹{inrEquivalent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (
                  <p className="text-sm text-white/40">Unable to fetch INR rate</p>
                )}
              </div>
            )}

            <CopyableAddress label="Platform TRC-20 Deposit Address" address={TRC20_DEPOSIT_ADDRESS} />

            <ShimmerButton
              shimmerColor="#f97316"
              background="rgba(249, 115, 22, 1)"
              className="w-full text-white"
              onClick={handleProceedToConfirm}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0}
            >
              I&apos;ve Sent the Deposit
            </ShimmerButton>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-sm text-white/70">Deposit Amount</p>
              <p className="text-lg font-semibold text-white">{depositAmount} USDT (TRC-20)</p>
              {inrEquivalent !== null && (
                <p className="text-sm text-white/50">
                  ~₹{inrEquivalent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tronSenderAddress" className="text-white/70">Sender TRON Address</Label>
              <Input
                id="tronSenderAddress"
                type="text"
                placeholder="e.g. TXqH3..."
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tronTxHash" className="text-white/70">Transaction Hash</Label>
              <Input
                id="tronTxHash"
                type="text"
                placeholder="Enter your TRON transaction hash"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('amount')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <ShimmerButton
                shimmerColor="#f97316"
                background="rgba(249, 115, 22, 1)"
                className="flex-1 text-white"
                onClick={handleSubmitDeposit}
                disabled={isSubmitting || !senderAddress.trim() || !txHash.trim()}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                ) : (
                  'Confirm Deposit'
                )}
              </ShimmerButton>
            </div>
          </>
        )}

        {/* Minimum deposit info */}
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-400">Minimum Deposit</p>
              <p className="text-xs text-white/60 mt-1">
                Minimum deposit amount is ₹50,000 (INR equivalent).
              </p>
            </div>
          </div>
        </div>

        {/* Principal lock info */}
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Principal Lock Period</p>
              <p className="text-xs text-white/60 mt-1">
                Your deposited principal will be locked for 4 months.
                Daily ROI earnings (0.35%) will be available for withdrawal immediately.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EvmDepositFlow({ selectedToken, onSuccess }: DepositTabProps) {
  const { address } = useWallet()
  const { refreshUser, setProfileData, getAccessToken } = useAuth()
  const { wallets } = useWallets()
  const { toast } = useToast()

  const [depositAmount, setDepositAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)

  const token = TOKENS[selectedToken]

  // On-chain deposit for ERC-20 and ETH
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid deposit amount', variant: 'destructive' })
      return
    }

    // Check minimum deposit (₹50,000 INR equivalent)
    const amount = parseFloat(depositAmount)
    const inrValue = await getApproxINRValue(token.baseToken, amount)
    if (inrValue > 0 && inrValue < MIN_DEPOSIT_INR) {
      toast({
        title: 'Below minimum deposit',
        description: `Minimum deposit is ₹50,000. Your deposit is worth approx ₹${inrValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
        variant: 'destructive',
      })
      return
    }

    if (!wallets.length) {
      toast({ title: 'No wallet connected', description: 'Please connect your wallet first', variant: 'destructive' })
      return
    }

    const activeWallet = wallets[0]
    const depositAddress = PLATFORM_DEPOSIT_ADDRESS as `0x${string}`

    setIsDepositing(true)
    try {
      const ethereumProvider = await activeWallet.getEthereumProvider()

      // Switch to Ethereum mainnet
      try {
        await ethereumProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x1' }],
        })
      } catch (switchError: unknown) {
        if (switchError && typeof switchError === 'object' && 'code' in switchError && (switchError as { code: number }).code === 4902) {
          await ethereumProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x1',
              chainName: mainnet.name,
              nativeCurrency: mainnet.nativeCurrency,
              rpcUrls: [mainnet.rpcUrls.default.http[0]],
              blockExplorerUrls: mainnet.blockExplorers ? [mainnet.blockExplorers.default.url] : undefined,
            }],
          })
        } else {
          toast({ title: 'Chain switch failed', description: 'Please switch your wallet to Ethereum', variant: 'destructive' })
          return
        }
      }

      const accounts = await ethereumProvider.request({ method: 'eth_accounts' }) as string[]
      const account = accounts[0] as `0x${string}`
      if (!account) {
        toast({ title: 'Error', description: 'Could not get wallet address', variant: 'destructive' })
        return
      }

      const publicClient = createPublicClient({ chain: mainnet, transport: http() })

      toast({ title: 'Confirm transaction', description: `Please confirm the ${token.name} transfer in your wallet` })

      let hash: `0x${string}`

      if (token.address) {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [depositAddress, parseUnits(depositAmount, token.decimals)],
        })
        hash = await ethereumProvider.request({
          method: 'eth_sendTransaction',
          params: [{ from: account, to: token.address, data }],
        }) as `0x${string}`
      } else {
        hash = await ethereumProvider.request({
          method: 'eth_sendTransaction',
          params: [{ from: account, to: depositAddress, value: `0x${parseEther(depositAmount).toString(16)}` }],
        }) as `0x${string}`
      }

      toast({ title: 'Transaction sent', description: 'Waiting for confirmation...' })

      let receiptStatus: 'success' | 'reverted' = 'success'
      let confirmedHash = hash
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
        receiptStatus = receipt.status
        confirmedHash = receipt.transactionHash
      } catch (receiptError) {
        // Timeout or RPC error — tx was sent, let the server verify on-chain
        console.warn('Client-side receipt wait failed, proceeding with server verification:', receiptError)
      }

      if (receiptStatus === 'reverted') {
        toast({ title: 'Transaction failed', description: 'The transaction was not successful', variant: 'destructive' })
        return
      }

      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')
      const response = await authFetch('/api/wallet/deposit', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          txHash: confirmedHash,
          amount: depositAmount,
          walletAddress: activeWallet.address,
          token: token.baseToken,
          network: token.network,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        if (responseData.profile) setProfileData(responseData.profile)
        const lockDate = responseData.lockInfo?.lockedUntil
          ? new Date(responseData.lockInfo.lockedUntil).toLocaleDateString()
          : null
        toast({
          title: 'Deposit successful',
          description: lockDate
            ? `${depositAmount} ${token.name} deposited. Principal locked until ${lockDate}.`
            : `${depositAmount} ${token.name} has been added to your balance`,
        })
        setDepositAmount('')
        await refreshUser()
        await onSuccess()
      } else {
        toast({ title: 'Deposit recording failed', description: responseData.error || 'Failed to record deposit', variant: 'destructive' })
      }
    } catch (error: unknown) {
      console.error('Deposit error:', error)
      toast({ title: 'Deposit failed', description: error instanceof Error ? error.message : 'Failed to process deposit', variant: 'destructive' })
    } finally {
      setIsDepositing(false)
    }
  }

  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Deposit {token.label}</CardTitle>
        <CardDescription className="text-white/50">
          Send {token.name} to add funds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="depositAmount" className="text-white/70">Amount ({token.name})</Label>
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

        <CopyableAddress label="Platform Deposit Address (ERC-20)" address={PLATFORM_DEPOSIT_ADDRESS} />

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
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            `Deposit ${token.name}`
          )}
        </ShimmerButton>

        {!address && (
          <p className="text-sm text-yellow-500 text-center">
            Please connect your wallet to make a deposit
          </p>
        )}

        {/* Minimum deposit info */}
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-400">Minimum Deposit</p>
              <p className="text-xs text-white/60 mt-1">
                Minimum deposit amount is ₹50,000 (INR equivalent).
              </p>
            </div>
          </div>
        </div>

        {/* Principal lock info */}
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Principal Lock Period</p>
              <p className="text-xs text-white/60 mt-1">
                Your deposited principal will be locked for 4 months.
                Daily ROI earnings (0.35%) will be available for withdrawal immediately.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DepositTab({ selectedToken, onSuccess }: DepositTabProps) {
  if (selectedToken === 'USDT-TRC20') {
    return <TronDepositFlow selectedToken={selectedToken} onSuccess={onSuccess} />
  }
  return <EvmDepositFlow selectedToken={selectedToken} onSuccess={onSuccess} />
}
