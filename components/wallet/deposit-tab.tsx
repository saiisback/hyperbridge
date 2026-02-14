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
import { sepolia } from 'viem/chains'
import type { TokenKey } from './token-selector'
import { TOKENS } from './token-selector'

const PLATFORM_DEPOSIT_ADDRESS = '0x531dB6ca6baE892b191f7F9122beA32F228fbee1'
const SEPOLIA_CHAIN_ID = 11155111

const USDT_MINT_ABI = [{
  name: '_giveMeATokens',
  type: 'function',
  inputs: [{ name: 'amount', type: 'uint256' }],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const

interface DepositTabProps {
  selectedToken: TokenKey
  onSuccess: () => Promise<void>
}

export function DepositTab({ selectedToken, onSuccess }: DepositTabProps) {
  const { address } = useWallet()
  const { refreshUser, setProfileData, getAccessToken } = useAuth()
  const { wallets } = useWallets()
  const { toast } = useToast()

  const [depositAmount, setDepositAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [isMinting, setIsMinting] = useState(false)

  const token = TOKENS[selectedToken]

  const copyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_DEPOSIT_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        args: [BigInt(1000 * 10 ** 6)],
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
      try {
        await activeWallet.switchChain(SEPOLIA_CHAIN_ID)
      } catch (switchError) {
        console.log('Chain switch error (may already be on Sepolia):', switchError)
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

      toast({
        title: 'Confirm transaction',
        description: `Please confirm the ${token.name} transfer in your wallet`,
      })

      let hash: `0x${string}`

      if (token.address) {
        hash = await walletClient.writeContract({
          account,
          address: token.address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [PLATFORM_DEPOSIT_ADDRESS as `0x${string}`, parseUnits(depositAmount, token.decimals)],
        })
      } else {
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
            token: selectedToken,
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
              ? `${depositAmount} ${token.name} deposited. Principal locked until ${lockDate}.`
              : `${depositAmount} ${token.name} has been added to your balance`,
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

  return (
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

        {address && (
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <p className="text-sm text-white/70 mb-1">Your Connected Wallet</p>
            <code className="text-sm text-white font-mono break-all">{address}</code>
          </div>
        )}

        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Principal Lock Period</p>
              <p className="text-xs text-white/60 mt-1">
                Your deposited principal will be locked for 4 months.
                Daily ROI earnings (0.5%) will be available for withdrawal immediately.
              </p>
            </div>
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
  )
}
