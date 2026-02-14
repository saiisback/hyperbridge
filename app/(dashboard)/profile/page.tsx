'use client'

import { useState } from 'react'
import {
  User,
  Mail,
  Wallet,
  Calendar,
  Copy,
  Check,
  Save,
  Plus,
  Star,
  Unlink,
  Chrome,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ShimmerButton } from '@/components/shimmer-button'
import { useAuth } from '@/context/auth-context'
import { getWalletClientName, formatProfileDate } from '@/lib/utils'
import type { LinkedAccountWithMetadata } from '@privy-io/react-auth'

export default function ProfilePage() {
  const {
    user,
    isLoading,
    linkEmail,
    linkWallet,
    linkGoogle,
    linkTwitter,
    unlinkAccount,
    updateProfile,
    setPrimaryWallet,
  } = useAuth()

  const [displayName, setDisplayName] = useState(user.name || '')
  const [copied, setCopied] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  // Get linked accounts from Privy
  const linkedAccounts = user.privyUser?.linkedAccounts || []
  const emailAccounts = linkedAccounts.filter((a) => a.type === 'email')
  const walletAccounts = linkedAccounts.filter((a) => a.type === 'wallet')
  const googleAccounts = linkedAccounts.filter((a) => a.type === 'google_oauth')
  const twitterAccounts = linkedAccounts.filter((a) => a.type === 'twitter_oauth')

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProfile({ name: displayName })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnlink = async (account: LinkedAccountWithMetadata) => {
    const accountId = account.type === 'wallet' ? account.address :
                     account.type === 'email' ? account.address :
                     account.type === 'google_oauth' ? account.email :
                     account.type === 'twitter_oauth' ? account.username : ''
    setUnlinking(accountId)
    try {
      await unlinkAccount(account)
    } finally {
      setUnlinking(null)
    }
  }

  const handleSetPrimary = async (walletAddress: string) => {
    await setPrimaryWallet(walletAddress)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Profile Header */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-2 border-orange-500/50">
              <AvatarFallback className="bg-orange-500/20 text-orange-500 text-2xl font-bold">
                {user.name?.slice(0, 2).toUpperCase() ||
                  user.primaryWallet?.slice(2, 4).toUpperCase() ||
                  'XX'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">
                {user.name || 'Anonymous User'}
              </h2>
              {user.primaryWallet && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-sm text-orange-500 font-mono">
                    {`${user.primaryWallet.slice(0, 10)}...${user.primaryWallet.slice(-8)}`}
                  </code>
                  <button
                    onClick={() => copyToClipboard(user.primaryWallet!, 'header')}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    {copied === 'header' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-white/50" />
                    )}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                  <span className="mr-1 size-1.5 rounded-full bg-green-500 animate-pulse" />
                  Connected
                </Badge>
                {user.authMethod && (
                  <Badge className="bg-white/10 text-white/70 border-white/20 capitalize">
                    {user.authMethod} Login
                  </Badge>
                )}
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

      {/* Linked Accounts */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Linked Accounts
          </CardTitle>
          <CardDescription className="text-white/50">
            Manage your connected authentication methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </h3>
              {emailAccounts.length === 0 && (
                <button
                  onClick={() => linkEmail()}
                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400"
                >
                  <Plus className="h-3 w-3" />
                  Add Email
                </button>
              )}
            </div>
            {emailAccounts.length > 0 ? (
              <div className="space-y-2">
                {emailAccounts.map((account) => (
                  <div
                    key={account.address}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                        <Mail className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white">{account.address}</p>
                        <p className="text-xs text-white/50">Verified</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                      <Check className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40 p-3 rounded-lg bg-white/5 border border-dashed border-white/10">
                No email linked. Add an email for account recovery.
              </p>
            )}
          </div>

          {/* Wallets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallets
              </h3>
              <button
                onClick={() => linkWallet()}
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400"
              >
                <Plus className="h-3 w-3" />
                Link Wallet
              </button>
            </div>
            {walletAccounts.length > 0 ? (
              <div className="space-y-2">
                {walletAccounts.map((account) => {
                  const isPrimary = account.address.toLowerCase() === user.primaryWallet?.toLowerCase()
                  return (
                    <div
                      key={account.address}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                          <Wallet className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-white font-mono">
                              {`${account.address.slice(0, 8)}...${account.address.slice(-6)}`}
                            </code>
                            <button
                              onClick={() => copyToClipboard(account.address, account.address)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                            >
                              {copied === account.address ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-white/50" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-white/50">
                            {getWalletClientName(account.walletClientType)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPrimary ? (
                          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/50">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Primary
                          </Badge>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSetPrimary(account.address)}
                              className="text-xs text-white/50 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                            >
                              Set Primary
                            </button>
                            {walletAccounts.length > 1 && (
                              <button
                                onClick={() => handleUnlink(account as LinkedAccountWithMetadata)}
                                disabled={unlinking === account.address}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
                              >
                                {unlinking === account.address ? (
                                  <span className="animate-pulse">...</span>
                                ) : (
                                  <Unlink className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-white/40 p-3 rounded-lg bg-white/5 border border-dashed border-white/10">
                No wallets linked. Connect a wallet for Web3 features.
              </p>
            )}
          </div>

          {/* Social Accounts Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/70">Social Accounts</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Google */}
              {googleAccounts.length > 0 ? (
                googleAccounts.map((account) => (
                  <div
                    key={account.email}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                        <Chrome className="h-5 w-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Google</p>
                        <p className="text-xs text-white/50 truncate max-w-[120px]">
                          {account.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink(account as LinkedAccountWithMetadata)}
                      disabled={unlinking === account.email}
                      className="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <button
                  onClick={() => linkGoogle()}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-dashed border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                    <Chrome className="h-5 w-5 text-red-400/50" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-white/70">Link Google</p>
                    <p className="text-xs text-white/40">Connect your account</p>
                  </div>
                </button>
              )}

              {/* Twitter */}
              {twitterAccounts.length > 0 ? (
                twitterAccounts.map((account) => (
                  <div
                    key={account.username}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1DA1F2]/20">
                        <svg className="h-5 w-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-white">Twitter</p>
                        <p className="text-xs text-white/50">@{account.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink(account as LinkedAccountWithMetadata)}
                      disabled={unlinking === account.username}
                      className="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <button
                  onClick={() => linkTwitter()}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-dashed border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1DA1F2]/10">
                    <svg className="h-5 w-5 text-[#1DA1F2]/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-white/70">Link Twitter</p>
                    <p className="text-xs text-white/40">Connect your account</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Account Information</CardTitle>
          <CardDescription className="text-white/50">
            Your account details and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-white/50">Member Since</p>
                <p className="text-sm text-white">
                  {formatProfileDate(user.dbUser?.createdAt || null)}
                </p>
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
                <p className="text-sm text-green-500">
                  {user.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
              {user.dbUser?.kycVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>

          {user.profile?.referralCode && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                  <User className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-white/50">Referral Code</p>
                  <code className="text-sm text-white font-mono">
                    {user.profile.referralCode}
                  </code>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(user.profile!.referralCode!, 'referral')}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                {copied === 'referral' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-white/70" />
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
