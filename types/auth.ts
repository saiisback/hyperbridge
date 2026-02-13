import type { User as PrivyUser, LinkedAccountWithMetadata } from '@privy-io/react-auth'
import type { User, Profile, UserWallet } from '@prisma/client'

// Auth method types
export type AuthMethod = 'email' | 'wallet' | 'google' | 'twitter' | 'discord'

// Extended user with all linked data
export interface AuthUser {
  // Privy data
  privyUser: PrivyUser | null
  privyId: string | null

  // Database user
  dbUser: User | null

  // Profile data
  profile: Profile | null

  // Linked wallets from database
  wallets: UserWallet[]

  // Convenience getters
  id: string | null
  name: string | null
  email: string | null
  primaryWallet: string | null
  avatarUrl: string | null
  isActive: boolean
  role: 'user' | 'admin'
  isAdmin: boolean

  // Auth state
  isAuthenticated: boolean
  isLoading: boolean
  authMethod: AuthMethod | null
}

// Linked account types from Privy
export interface LinkedEmail {
  type: 'email'
  address: string
  verifiedAt?: Date
}

export interface LinkedWallet {
  type: 'wallet'
  address: string
  chainType: 'ethereum' | 'solana'
  walletClient?: string
  walletClientType?: string
  connectorType?: string
}

export interface LinkedGoogle {
  type: 'google_oauth'
  email: string
  name?: string
}

export interface LinkedTwitter {
  type: 'twitter_oauth'
  username: string
  name?: string
}

export interface LinkedDiscord {
  type: 'discord_oauth'
  username: string
}

export type LinkedAccount =
  | LinkedEmail
  | LinkedWallet
  | LinkedGoogle
  | LinkedTwitter
  | LinkedDiscord

// Auth context type
export interface AuthContextType {
  user: AuthUser

  // Auth state
  isAuthenticated: boolean
  isLoading: boolean
  isReady: boolean

  // Actions
  login: () => void
  logout: () => Promise<void>
  linkEmail: () => void
  linkWallet: () => void
  linkGoogle: () => void
  linkTwitter: () => void
  linkDiscord: () => void
  unlinkAccount: (account: LinkedAccountWithMetadata) => Promise<void>

  // Profile actions
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>
  setPrimaryWallet: (walletAddress: string) => Promise<void>
  refreshUser: () => Promise<void>
  setProfileData: (profile: Profile | null) => void
  getAccessToken: () => Promise<string | null>
}
