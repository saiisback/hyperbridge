'use client'

import { useState } from 'react'
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
import { createWalletClient, createPublicClient, custom, http, parseEther, parseUnits, erc20Abi } from 'viem'
import { mainnet, bsc } from 'viem/chains'
import type { TokenKey } from './token-selector'
import { TOKENS } from './token-selector'

const PLATFORM_DEPOSIT_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_DEPOSIT_ADDRESS || ''
const BEP20_DEPOSIT_ADDRESS = '0xef7063e1329331343fe88478421a2af15a725030'
const TRC20_DEPOSIT_ADDRESS = 'TZA7cFmFFtTsKrVkLqdSPSHpZzD8if189t'

const CHAIN_CONFIG = {
  ethereum: { chain: mainnet, chainId: 1 },
  bsc: { chain: bsc, chainId: 56 },
} as const

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

export function DepositTab({ selectedToken, onSuccess }: DepositTabProps) {
  const { address } = useWallet()
  const { refreshUser, setProfileData, getAccessToken } = useAuth()
  const { wallets } = useWallets()
  const { toast } = useToast()

  const [depositAmount, setDepositAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [manualTxHash, setManualTxHash] = useState('')
  const [manualSubmitted, setManualSubmitted] = useState(false)

  const token = TOKENS[selectedToken]
  const isTrc20 = selectedToken === 'USDT-TRC20'
  const isBep20 = selectedToken === 'USDT-BEP20'

  const getDepositAddress = (): string => {
    if (isBep20) return BEP20_DEPOSIT_ADDRESS
    if (isTrc20) return TRC20_DEPOSIT_ADDRESS
    return PLATFORM_DEPOSIT_ADDRESS
  }

  const getDepositLabel = (): string => {
    if (isBep20) return 'USDT Deposit Address (BEP-20 — Binance Smart Chain)'
    if (isTrc20) return 'USDT Deposit Address (TRC-20 — Tron)'
    if (selectedToken === 'USDT-ERC20') return 'Platform Deposit Address (ERC-20)'
    return 'Platform Deposit Address (ERC-20)'
  }

  // On-chain deposit for ERC-20 and BEP-20
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid deposit amount', variant: 'destructive' })
      return
    }

    if (!wallets.length) {
      toast({ title: 'No wallet connected', description: 'Please connect your wallet first', variant: 'destructive' })
      return
    }

    const activeWallet = wallets[0]
    const networkKey = token.network as 'ethereum' | 'bsc'
    const { chain, chainId } = CHAIN_CONFIG[networkKey]
    const depositAddress = getDepositAddress() as `0x${string}`

    setIsDepositing(true)
    try {
      try {
        await activeWallet.switchChain(chainId)
      } catch (switchError) {
        console.log('Chain switch error (may already be on correct chain):', switchError)
      }

      const ethereumProvider = await activeWallet.getEthereumProvider()
      const walletClient = createWalletClient({ chain, transport: custom(ethereumProvider) })
      const publicClient = createPublicClient({ chain, transport: http() })
      const [account] = await walletClient.getAddresses()

      toast({ title: 'Confirm transaction', description: `Please confirm the ${token.name} transfer in your wallet` })

      let hash: `0x${string}`

      if (token.address) {
        hash = await walletClient.writeContract({
          account,
          address: token.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [depositAddress, parseUnits(depositAmount, token.decimals)],
        })
      } else {
        hash = await walletClient.sendTransaction({
          account,
          to: depositAddress,
          value: parseEther(depositAmount),
        })
      }

      toast({ title: 'Transaction sent', description: 'Waiting for confirmation...' })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        const accessToken = await getAccessToken()
        if (!accessToken) throw new Error('Not authenticated')
        const response = await authFetch('/api/wallet/deposit', accessToken, {
          method: 'POST',
          body: JSON.stringify({
            txHash: receipt.transactionHash,
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
      } else {
        toast({ title: 'Transaction failed', description: 'The transaction was not successful', variant: 'destructive' })
      }
    } catch (error: unknown) {
      console.error('Deposit error:', error)
      toast({ title: 'Deposit failed', description: error instanceof Error ? error.message : 'Failed to process deposit', variant: 'destructive' })
    } finally {
      setIsDepositing(false)
    }
  }

  // Manual deposit for TRC-20
  const handleManualDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid deposit amount', variant: 'destructive' })
      return
    }
    if (!manualTxHash.trim()) {
      toast({ title: 'Missing transaction hash', description: 'Please enter your transaction hash', variant: 'destructive' })
      return
    }

    setIsDepositing(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')

      const response = await authFetch('/api/wallet/deposit-manual', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          txHash: manualTxHash.trim(),
          amount: depositAmount,
          network: 'trc20',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setManualSubmitted(true)
        toast({ title: 'Deposit submitted', description: `Your ${depositAmount} USDT deposit will be credited after admin verification.` })
        await onSuccess()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to submit deposit', variant: 'destructive' })
      }
    } catch (error: unknown) {
      console.error('Manual deposit error:', error)
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to submit deposit', variant: 'destructive' })
    } finally {
      setIsDepositing(false)
    }
  }

  const resetManualDeposit = () => {
    setManualTxHash('')
    setManualSubmitted(false)
    setDepositAmount('')
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
        {/* TRC-20 manual flow */}
        {isTrc20 ? (
          <>
            {!manualSubmitted ? (
              <>
                <CopyableAddress label={getDepositLabel()} address={getDepositAddress()} />

                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white/70">
                      Send only <span className="text-orange-400 font-medium">USDT</span> on the <span className="text-orange-400 font-medium">Tron (TRC-20)</span> network to the address above from your Tron wallet (e.g. TronLink). Then paste your transaction hash below.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trc20Amount" className="text-white/70">Amount (USDT)</Label>
                  <Input
                    id="trc20Amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount you sent"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                    disabled={isDepositing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trc20TxHash" className="text-white/70">Transaction Hash</Label>
                  <Input
                    id="trc20TxHash"
                    type="text"
                    placeholder="Paste your TRC-20 transaction hash"
                    value={manualTxHash}
                    onChange={(e) => setManualTxHash(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 font-mono text-sm"
                    disabled={isDepositing}
                  />
                </div>

                <ShimmerButton
                  shimmerColor="#f97316"
                  background="rgba(249, 115, 22, 1)"
                  className="w-full text-white"
                  onClick={handleManualDeposit}
                  disabled={isDepositing || !depositAmount || !manualTxHash.trim()}
                >
                  {isDepositing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    'Submit Deposit'
                  )}
                </ShimmerButton>
              </>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-400 mb-1">Deposit Submitted</p>
                  <p className="text-xs text-white/60">
                    Your {depositAmount} USDT deposit via TRC-20 has been submitted. Your balance will be credited after admin verification.
                  </p>
                </div>
                <button onClick={resetManualDeposit} className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition-colors">
                  Submit another deposit
                </button>
              </>
            )}
          </>
        ) : (
          /* ERC-20, BEP-20, and ETH on-chain flow */
          <>
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

            <CopyableAddress label={getDepositLabel()} address={getDepositAddress()} />

            {address && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <p className="text-sm text-white/70 mb-1">Your Connected Wallet</p>
                <code className="text-sm text-white font-mono break-all">{address}</code>
              </div>
            )}

            {isBep20 && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-white/70">
                    Your wallet will be switched to <span className="text-orange-400 font-medium">Binance Smart Chain (BEP-20)</span>. Send only <span className="text-orange-400 font-medium">USDT</span> on this network.
                  </p>
                </div>
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
          </>
        )}

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
