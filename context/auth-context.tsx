'use client'

import * as React from 'react'
import { usePrivy, useLogin, useLogout, useToken } from '@privy-io/react-auth'
import type { LinkedAccountWithMetadata } from '@privy-io/react-auth'
import type { User, Profile, UserWallet } from '@prisma/client'
import type { AuthContextType, AuthUser, AuthMethod } from '@/types/auth'
import { authFetch } from '@/lib/api'

const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    user: privyUser,
    ready,
    authenticated,
    linkEmail,
    linkWallet,
    linkGoogle,
    linkTwitter,
    linkDiscord,
    unlinkEmail,
    unlinkWallet,
    unlinkGoogle,
    unlinkTwitter,
    unlinkDiscord,
  } = usePrivy()

  const { getAccessToken } = useToken()

  const { login } = useLogin({
    onComplete: (user) => {
      console.log('Login complete:', user.user.id)
      syncUserToDatabase()
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
  })

  const { logout } = useLogout({
    onSuccess: () => {
      setDbUser(null)
      setProfile(null)
      setWallets([])
    },
  })

  // Database state
  const [dbUser, setDbUser] = React.useState<User | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [wallets, setWallets] = React.useState<UserWallet[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Determine auth method
  const authMethod = React.useMemo<AuthMethod | null>(() => {
    if (!privyUser) return null
    const linkedAccounts = privyUser.linkedAccounts || []

    // Check which method was used first (usually the primary)
    const hasEmail = linkedAccounts.some((a) => a.type === 'email')
    const hasWallet = linkedAccounts.some((a) => a.type === 'wallet')
    const hasGoogle = linkedAccounts.some((a) => a.type === 'google_oauth')
    const hasTwitter = linkedAccounts.some((a) => a.type === 'twitter_oauth')
    const hasDiscord = linkedAccounts.some((a) => a.type === 'discord_oauth')

    if (hasWallet) return 'wallet'
    if (hasEmail) return 'email'
    if (hasGoogle) return 'google'
    if (hasTwitter) return 'twitter'
    if (hasDiscord) return 'discord'
    return null
  }, [privyUser])

  // Sync Privy user to database
  const syncUserToDatabase = React.useCallback(async () => {
    if (!privyUser) return

    setIsLoading(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const response = await authFetch('/api/auth/sync', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          email: privyUser.email?.address || null,
          referredBy: localStorage.getItem('referralCode') || undefined,
          wallets: privyUser.linkedAccounts
            ?.filter((a): a is LinkedAccountWithMetadata & { type: 'wallet' } => a.type === 'wallet')
            .map((w) => ({
              address: w.address,
              chainType: w.chainType || 'ethereum',
              walletClient: w.walletClientType || null,
            })) || [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDbUser(data.user)
        setProfile(data.profile)
        setWallets(data.wallets)
        // Clear referral code after successful sync
        localStorage.removeItem('referralCode')
      }
    } catch (error) {
      console.error('Failed to sync user:', error)
    } finally {
      setIsLoading(false)
    }
  }, [privyUser, getAccessToken])

  // Fetch user data from database
  const fetchUserData = React.useCallback(async () => {
    if (!privyUser?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setIsLoading(false)
        return
      }

      // Use the sync endpoint to fetch/sync user data
      const response = await authFetch('/api/auth/sync', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          email: privyUser.email?.address || null,
          referredBy: localStorage.getItem('referralCode') || undefined,
          wallets: privyUser.linkedAccounts
            ?.filter((a): a is LinkedAccountWithMetadata & { type: 'wallet' } => a.type === 'wallet')
            .map((w) => ({
              address: w.address,
              chainType: w.chainType || 'ethereum',
              walletClient: w.walletClientType || null,
            })) || [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDbUser(data.user)
        setProfile(data.profile)
        setWallets(data.wallets)
        // Clear referral code after successful sync
        localStorage.removeItem('referralCode')
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [privyUser, getAccessToken])

  // Initial data fetch
  React.useEffect(() => {
    if (ready && authenticated && privyUser) {
      fetchUserData()
    } else if (ready && !authenticated) {
      setIsLoading(false)
    }
  }, [ready, authenticated, privyUser, fetchUserData])

  // Update profile
  const updateProfile = React.useCallback(
    async (data: { name?: string; email?: string }) => {
      if (!dbUser || !privyUser) return

      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const response = await authFetch('/api/profile/update', accessToken, {
          method: 'POST',
          body: JSON.stringify(data),
        })

        if (response.ok) {
          const result = await response.json()
          setDbUser(result.user)
          setProfile(result.profile)
        } else {
          console.error('Failed to update profile')
        }
      } catch (error) {
        console.error('Failed to update profile:', error)
      }
    },
    [dbUser, privyUser, getAccessToken]
  )

  // Set primary wallet
  const setPrimaryWallet = React.useCallback(
    async (walletAddress: string) => {
      if (!dbUser || !privyUser) return

      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const response = await authFetch('/api/profile/primary-wallet', accessToken, {
          method: 'POST',
          body: JSON.stringify({ walletAddress }),
        })

        if (response.ok) {
          const result = await response.json()
          setDbUser(result.user)
          setProfile(result.profile)
          setWallets(result.wallets)
        } else {
          console.error('Failed to set primary wallet')
        }
      } catch (error) {
        console.error('Failed to set primary wallet:', error)
      }
    },
    [dbUser, privyUser, getAccessToken]
  )

  // Unlink account
  const handleUnlinkAccount = React.useCallback(
    async (account: LinkedAccountWithMetadata) => {
      switch (account.type) {
        case 'email':
          await unlinkEmail(account.address)
          break
        case 'wallet':
          await unlinkWallet(account.address)
          break
        case 'google_oauth':
          await unlinkGoogle(account.subject)
          break
        case 'twitter_oauth':
          await unlinkTwitter(account.subject)
          break
        case 'discord_oauth':
          await unlinkDiscord(account.subject)
          break
      }
      // Sync changes to database
      await syncUserToDatabase()
    },
    [unlinkEmail, unlinkWallet, unlinkGoogle, unlinkTwitter, unlinkDiscord, syncUserToDatabase]
  )

  // Build auth user object
  const user = React.useMemo<AuthUser>(() => {
    const email = privyUser?.email?.address || dbUser?.email || null
    const primaryWallet =
      dbUser?.primaryWallet ||
      privyUser?.linkedAccounts?.find((a): a is LinkedAccountWithMetadata & { type: 'wallet' } => a.type === 'wallet')?.address ||
      null

    return {
      privyUser: privyUser || null,
      privyId: privyUser?.id || null,
      dbUser,
      profile,
      wallets,
      id: dbUser?.id || null,
      name: dbUser?.name || null,
      email,
      primaryWallet,
      avatarUrl: dbUser?.avatarUrl || null,
      isActive: dbUser?.isActive ?? true,
      role: dbUser?.role || 'user',
      isAdmin: dbUser?.role === 'admin',
      isAuthenticated: authenticated,
      isLoading,
      authMethod,
    }
  }, [privyUser, dbUser, profile, wallets, authenticated, isLoading, authMethod])

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: authenticated,
      isLoading: isLoading || !ready,
      isReady: ready,
      login,
      logout,
      linkEmail,
      linkWallet,
      linkGoogle,
      linkTwitter,
      linkDiscord,
      unlinkAccount: handleUnlinkAccount,
      updateProfile,
      setPrimaryWallet,
      refreshUser: fetchUserData,
      setProfileData: setProfile,
      getAccessToken,
    }),
    [
      user,
      authenticated,
      isLoading,
      ready,
      login,
      logout,
      linkEmail,
      linkWallet,
      linkGoogle,
      linkTwitter,
      linkDiscord,
      handleUnlinkAccount,
      updateProfile,
      setPrimaryWallet,
      fetchUserData,
      getAccessToken,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
