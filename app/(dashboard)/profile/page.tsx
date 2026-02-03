'use client'

import { useState } from 'react'
import { User, Mail, Wallet, Calendar, Copy, Check, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ShimmerButton } from '@/components/shimmer-button'
import { useWallet } from '@/hooks/use-wallet'

export default function ProfilePage() {
  const { address, walletType } = useWallet()
  const [displayName, setDisplayName] = useState('Anonymous User')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const getWalletName = (type: string | null) => {
    switch (type) {
      case 'metamask':
        return 'MetaMask'
      case 'walletconnect':
        return 'WalletConnect'
      case 'coinbase':
        return 'Coinbase Wallet'
      default:
        return 'Unknown Wallet'
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Header */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-2 border-orange-500/50">
              <AvatarFallback className="bg-orange-500/20 text-orange-500 text-2xl font-bold">
                {address?.slice(2, 4).toUpperCase() || 'XX'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{displayName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-sm text-orange-500 font-mono">
                  {address
                    ? `${address.slice(0, 10)}...${address.slice(-8)}`
                    : 'Not connected'}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-white/50" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                  <span className="mr-1 size-1.5 rounded-full bg-green-500 animate-pulse" />
                  Connected
                </Badge>
                <Badge className="bg-white/10 text-white/70 border-white/20">
                  {getWalletName(walletType)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Profile Details</CardTitle>
          <CardDescription className="text-white/50">
            Update your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-white/70">
              <User className="inline h-4 w-4 mr-2" />
              Display Name
            </Label>
            <Input
              id="displayName"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70">
              <Mail className="inline h-4 w-4 mr-2" />
              Email (Optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
            />
            <p className="text-xs text-white/40">
              Used for notifications and account recovery
            </p>
          </div>

          <ShimmerButton
            onClick={handleSave}
            disabled={isSaving}
            shimmerColor="#f97316"
            background="rgba(249, 115, 22, 1)"
            className="text-white"
          >
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </ShimmerButton>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Account Information</CardTitle>
          <CardDescription className="text-white/50">
            Your wallet and account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                <Wallet className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-white/50">Wallet Address</p>
                <p className="font-mono text-sm text-white">
                  {address || 'Not connected'}
                </p>
              </div>
            </div>
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

          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-white/50">Member Since</p>
                <p className="text-sm text-white">January 1, 2024</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                <User className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-white/50">Account Status</p>
                <p className="text-sm text-green-500">Active</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
              Verified
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
