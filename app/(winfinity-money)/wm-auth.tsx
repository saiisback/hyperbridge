'use client'

import * as React from 'react'
import { usePrivy, useLogin, useLogout, useToken } from '@privy-io/react-auth'
import { authFetch } from '@/lib/api'

interface WmUser {
  id: string
  name: string | null
  email: string | null
  role: string
  referralCode: string | null
}

interface WmAuthContextType {
  user: WmUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isReady: boolean
  error: string | null
  login: () => void
  logout: () => void
  getAccessToken: () => Promise<string | null>
}

const WmAuthContext = React.createContext<WmAuthContextType | null>(null)

export function WmAuthProvider({ children }: { children: React.ReactNode }) {
  const { user: privyUser, ready, authenticated } = usePrivy()
  const { getAccessToken: _getAccessToken } = useToken()
  const getAccessTokenRef = React.useRef(_getAccessToken)
  getAccessTokenRef.current = _getAccessToken
  const getAccessToken = React.useCallback(() => getAccessTokenRef.current(), [])

  const [wmUser, setWmUser] = React.useState<WmUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const syncRef = React.useRef<() => Promise<void>>(() => Promise.resolve())

  const syncUser = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) return

      // We only call sync to check if user exists — sign-in only
      const res = await authFetch('/api/auth/sync', token, {
        method: 'POST',
        body: JSON.stringify({
          email: null,
          wallets: [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setWmUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          referralCode: data.profile?.referralCode || null,
        })
      } else {
        setError('Account not found. Please sign up on the main platform first.')
        setWmUser(null)
      }
    } catch {
      setError('Failed to verify account.')
      setWmUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  syncRef.current = syncUser

  const { login } = useLogin({
    onComplete: () => syncRef.current(),
    onError: () => setError('Login failed. Please try again.'),
  })

  const { logout } = useLogout({
    onSuccess: () => {
      setWmUser(null)
      setError(null)
    },
  })

  React.useEffect(() => {
    if (ready && authenticated && privyUser) {
      syncRef.current()
    } else if (ready && !authenticated) {
      setIsLoading(false)
    }
  }, [ready, authenticated, privyUser?.id])

  const value = React.useMemo<WmAuthContextType>(
    () => ({
      user: wmUser,
      isAuthenticated: authenticated && !!wmUser,
      isLoading: isLoading || !ready,
      isReady: ready,
      error,
      login,
      logout,
      getAccessToken,
    }),
    [wmUser, authenticated, isLoading, ready, error, login, logout, getAccessToken]
  )

  return <WmAuthContext.Provider value={value}>{children}</WmAuthContext.Provider>
}

export function useWmAuth() {
  const ctx = React.useContext(WmAuthContext)
  if (!ctx) throw new Error('useWmAuth must be used within WmAuthProvider')
  return ctx
}
