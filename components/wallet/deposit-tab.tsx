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
const MAINNET_CHAIN_ID = 1
const BSC_CHAIN_ID = 56
// BSC USDT (Binance-Peg) contract — 18 decimals
const BSC_USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`
const BSC_USDT_DECIMALS = 18

type NetworkTab = 'erc20' | 'bep20' | 'trc20' | 'bank'

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
  const [activeNetwork, setActiveNetwork] = useState<NetworkTab>('erc20')
  const [manualTxHash, setManualTxHash] = useState('')
  const [manualSubmitted, setManualSubmitted] = useState(false)
  const [bankRemarkCode, setBankRemarkCode] = useState<string | null>(null)
  const [bankDetails, setBankDetails] = useState<{
    bankName: string; accountNumber: string; ifsc: string; accountHolder: string; upiId: string
  } | null>(null)
  const [bankDepositPending, setBankDepositPending] = useState(false)

  const token = TOKENS[selectedToken]

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

    // Network-specific config
    const isBep20 = activeNetwork === 'bep20'
    const chainId = isBep20 ? BSC_CHAIN_ID : MAINNET_CHAIN_ID
    const chain = isBep20 ? bsc : mainnet
    const depositAddress = isBep20
      ? (BEP20_DEPOSIT_ADDRESS as `0x${string}`)
      : (PLATFORM_DEPOSIT_ADDRESS as `0x${string}`)
    const networkName = isBep20 ? 'bsc' : 'ethereum'

    setIsDepositing(true)
    try {
      try {
        await activeWallet.switchChain(chainId)
      } catch (switchError) {
        console.log('Chain switch error (may already be on correct chain):', switchError)
      }

      const ethereumProvider = await activeWallet.getEthereumProvider()
      const walletClient = createWalletClient({
        chain,
        transport: custom(ethereumProvider),
      })
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      })

      const [account] = await walletClient.getAddresses()

      toast({
        title: 'Confirm transaction',
        description: `Please confirm the ${isBep20 ? 'USDT' : token.name} transfer in your wallet`,
      })

      let hash: `0x${string}`

      if (isBep20) {
        // BEP-20 USDT transfer on BSC
        hash = await walletClient.writeContract({
          account,
          address: BSC_USDT_CONTRACT,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [depositAddress, parseUnits(depositAmount, BSC_USDT_DECIMALS)],
        })
      } else if (token.address) {
        // ERC-20 token transfer on Ethereum
        hash = await walletClient.writeContract({
          account,
          address: token.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [depositAddress, parseUnits(depositAmount, token.decimals)],
        })
      } else {
        // Native ETH transfer
        hash = await walletClient.sendTransaction({
          account,
          to: depositAddress,
          value: parseEther(depositAmount),
        })
      }

      toast({
        title: 'Transaction sent',
        description: 'Waiting for confirmation...',
      })

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
            token: isBep20 ? 'USDT' : selectedToken,
            network: networkName,
          }),
        })

        const responseData = await response.json()

        if (response.ok) {
          if (responseData.profile) {
            setProfileData(responseData.profile)
          }
          const lockDate = responseData.lockInfo?.lockedUntil
            ? new Date(responseData.lockInfo.lockedUntil).toLocaleDateString()
            : null
          toast({
            title: 'Deposit successful',
            description: lockDate
              ? `${depositAmount} ${isBep20 ? 'USDT' : token.name} deposited. Principal locked until ${lockDate}.`
              : `${depositAmount} ${isBep20 ? 'USDT' : token.name} has been added to your balance`,
          })
          setDepositAmount('')
          await refreshUser()
          await onSuccess()
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

  const handleBankDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount < 100) {
      toast({
        title: 'Invalid amount',
        description: 'Minimum deposit is ₹100',
        variant: 'destructive',
      })
      return
    }

    setIsDepositing(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Not authenticated')

      const response = await authFetch('/api/wallet/deposit-inr', accessToken, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      })

      const data = await response.json()

      if (response.ok) {
        setBankRemarkCode(data.transaction.remarkCode)
        setBankDetails(data.bankDetails)
        setBankDepositPending(true)
        toast({
          title: 'Deposit initiated',
          description: `Use remark code ${data.transaction.remarkCode} in your bank transfer`,
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to initiate deposit',
          variant: 'destructive',
        })
      }
    } catch (error: unknown) {
      console.error('Bank deposit error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to initiate deposit',
        variant: 'destructive',
      })
    } finally {
      setIsDepositing(false)
    }
  }

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
          network: activeNetwork,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setManualSubmitted(true)
        toast({
          title: 'Deposit submitted',
          description: `Your ${depositAmount} USDT deposit will be credited after admin verification.`,
        })
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

  const resetBankDeposit = () => {
    setBankRemarkCode(null)
    setBankDetails(null)
    setBankDepositPending(false)
    setDepositAmount('')
  }

  const networkTabs: { key: NetworkTab; label: string; shortLabel: string }[] = [
    { key: 'erc20', label: 'ERC-20 (Ethereum)', shortLabel: 'ERC-20' },
    { key: 'bep20', label: 'BEP-20 (BSC)', shortLabel: 'BEP-20' },
    { key: 'trc20', label: 'TRC-20 (Tron)', shortLabel: 'TRC-20' },
  ]

  return (
    <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
      <CardHeader>
        <CardTitle className="text-white">Deposit {token.name}</CardTitle>
        <CardDescription className="text-white/50">
          Select a network and send {token.name} to add funds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Network sub-tabs */}
        <div className="flex gap-2">
          {networkTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveNetwork(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeNetwork === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* ERC-20 tab content */}
        {activeNetwork === 'erc20' && (
          <>
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

            <CopyableAddress
              label="Platform Deposit Address (ERC-20)"
              address={PLATFORM_DEPOSIT_ADDRESS}
            />

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

        {/* BEP-20 tab content */}
        {activeNetwork === 'bep20' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="bep20Amount" className="text-white/70">
                Amount (USDT)
              </Label>
              <Input
                id="bep20Amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount in USDT"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                disabled={isDepositing}
              />
            </div>

            <CopyableAddress
              label="USDT Deposit Address (BEP-20 — Binance Smart Chain)"
              address={BEP20_DEPOSIT_ADDRESS}
            />

            {address && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <p className="text-sm text-white/70 mb-1">Your Connected Wallet</p>
                <code className="text-sm text-white font-mono break-all">{address}</code>
              </div>
            )}

            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/70">
                  Your wallet will be switched to <span className="text-orange-400 font-medium">Binance Smart Chain (BEP-20)</span>. Send only <span className="text-orange-400 font-medium">USDT</span> on this network.
                </p>
              </div>
            </div>

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
                'Deposit USDT (BEP-20)'
              )}
            </ShimmerButton>

            {!address && (
              <p className="text-sm text-yellow-500 text-center">
                Please connect your wallet to make a deposit
              </p>
            )}
          </>
        )}

        {/* TRC-20 tab content */}
        {activeNetwork === 'trc20' && (
          <>
            {!manualSubmitted ? (
              <>
                <CopyableAddress
                  label="USDT Deposit Address (TRC-20 — Tron)"
                  address={TRC20_DEPOSIT_ADDRESS}
                />

                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white/70">
                      Send only <span className="text-orange-400 font-medium">USDT</span> on the <span className="text-orange-400 font-medium">Tron (TRC-20)</span> network to the address above from your wallet app. Then paste your transaction hash below.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trc20Amount" className="text-white/70">
                    Amount (USDT)
                  </Label>
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
                  <Label htmlFor="trc20TxHash" className="text-white/70">
                    Transaction Hash
                  </Label>
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
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
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
                <button
                  onClick={resetManualDeposit}
                  className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                >
                  Submit another deposit
                </button>
              </>
            )}
          </>
        )}

        {/* Bank Transfer tab content */}
        {activeNetwork === 'bank' && (
          <>
            {!bankDepositPending ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bankDepositAmount" className="text-white/70">
                    Amount (INR)
                  </Label>
                  <Input
                    id="bankDepositAmount"
                    type="number"
                    step="1"
                    min="100"
                    placeholder="Enter amount in INR (min ₹100)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                    disabled={isDepositing}
                  />
                </div>

                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white/70">
                      Transfer INR via <span className="text-orange-400 font-medium">UPI, IMPS, or NEFT</span> directly to our bank account. Include the remark code provided after clicking the button below.
                    </p>
                  </div>
                </div>

                <ShimmerButton
                  shimmerColor="#f97316"
                  background="rgba(249, 115, 22, 1)"
                  className="w-full text-white"
                  onClick={handleBankDeposit}
                  disabled={isDepositing}
                >
                  {isDepositing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Get Bank Details & Remark Code'
                  )}
                </ShimmerButton>
              </>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-400 mb-1">Deposit Initiated — ₹{parseFloat(depositAmount).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-white/60">
                    Transfer the exact amount to the bank details below with the remark code. Your balance will be credited after admin verification.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-orange-500/20 border border-orange-500/50">
                  <p className="text-sm text-white/70 mb-2">Remark Code (include in transfer)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-2xl text-orange-500 font-mono font-bold tracking-widest text-center">
                      {bankRemarkCode}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bankRemarkCode || '')
                        toast({ title: 'Copied!', description: 'Remark code copied to clipboard' })
                      }}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <Copy className="h-4 w-4 text-white/70" />
                    </button>
                  </div>
                </div>

                {bankDetails && (
                  <div className="space-y-3">
                    {bankDetails.upiId && (
                      <CopyableAddress label="UPI ID" address={bankDetails.upiId} />
                    )}
                    {bankDetails.accountNumber && (
                      <CopyableAddress label="Account Number" address={bankDetails.accountNumber} />
                    )}
                    {bankDetails.ifsc && (
                      <CopyableAddress label="IFSC Code" address={bankDetails.ifsc} />
                    )}
                    {bankDetails.accountHolder && (
                      <CopyableAddress label="Account Holder" address={bankDetails.accountHolder} />
                    )}
                    {bankDetails.bankName && (
                      <CopyableAddress label="Bank Name" address={bankDetails.bankName} />
                    )}
                  </div>
                )}

                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-white/70">
                      Awaiting your bank transfer. Once payment is verified by admin, your balance will be credited in USDT at the live conversion rate.
                    </p>
                  </div>
                </div>

                <button
                  onClick={resetBankDeposit}
                  className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                >
                  Start a new deposit
                </button>
              </>
            )}
          </>
        )}

        {/* Principal lock info — shown on all tabs */}
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
