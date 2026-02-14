'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Chrome } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export default function LoginPage() {
  const { isAuthenticated, isLoading, isReady, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isReady, isAuthenticated, router])

  if (!isReady || isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-orange-500/20 p-4 border border-orange-500/30">
            <img
              src="/logo.svg"
              alt="Winfinitty Logo"
              className="h-10 w-10 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Win<span className="text-orange-500">finitty</span>
          </h1>
          <p className="mt-3 text-white/60">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Auth Options */}
        <div className="space-y-4">
          {/* Main Sign In Button - Opens Privy Modal */}
          <button
            onClick={login}
            className="group relative w-full rounded-xl border border-orange-500/50 bg-orange-500 p-4 text-white font-semibold transition-all duration-300 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25"
          >
            <div className="flex items-center justify-center gap-3">
              <Wallet className="h-5 w-5" />
              Sign In / Sign Up
            </div>
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-black px-4 text-white/40">Available sign-in methods</span>
            </div>
          </div>

          {/* Sign-in method indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                <Wallet className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Wallet</p>
                <p className="text-xs text-white/50">Web3 wallets</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                <Chrome className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Google</p>
                <p className="text-xs text-white/50">Social login</p>
              </div>
            </div>
          </div>

          {/* Supported Wallets Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-white/40 mb-3">Supported Wallets</p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <svg viewBox="0 0 40 40" className="h-5 w-5">
                  <path fill="#E17726" d="M35.94 4.58 22.44 14.53l2.5-5.95 10.99-4Z"/>
                  <path fill="#E27625" d="m4.06 4.58 13.37 10.06-2.37-6.06L4.06 4.58ZM30.91 27.68l-3.59 5.51 7.69 2.11 2.2-7.51-6.3-.11ZM2.82 27.79l2.19 7.51 7.67-2.11-3.58-5.51-6.28.11Z"/>
                </svg>
                <span className="text-xs text-white/60">MetaMask</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <svg viewBox="0 0 40 40" className="h-5 w-5">
                  <rect fill="#3B99FC" rx="6" height="40" width="40"/>
                  <path fill="#fff" d="M12.18 15.29c4.32-4.23 11.32-4.23 15.64 0l.52.51a.53.53 0 0 1 0 .77l-1.78 1.74a.28.28 0 0 1-.39 0l-.72-.7a7.95 7.95 0 0 0-10.91 0l-.77.75a.28.28 0 0 1-.39 0l-1.78-1.74a.53.53 0 0 1 0-.77l.58-.56Z"/>
                </svg>
                <span className="text-xs text-white/60">WalletConnect</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <svg viewBox="0 0 40 40" className="h-5 w-5">
                  <rect fill="#0052FF" rx="6" height="40" width="40"/>
                  <path fill="#fff" d="M20 6C12.27 6 6 12.27 6 20s6.27 14 14 14 14-6.27 14-14S27.73 6 20 6Zm-4.2 11.2a1.4 1.4 0 0 1 1.4-1.4h5.6a1.4 1.4 0 0 1 1.4 1.4v5.6a1.4 1.4 0 0 1-1.4 1.4h-5.6a1.4 1.4 0 0 1-1.4-1.4v-5.6Z"/>
                </svg>
                <span className="text-xs text-white/60">Coinbase</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-white/30">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
