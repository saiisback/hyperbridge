'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWallet } from '@/hooks/use-wallet'

export default function LoginPage() {
  const { isConnected } = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

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
            <Wallet className="h-10 w-10 text-orange-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Hyper<span className="text-orange-500">Bridge</span>
          </h1>
          <p className="mt-3 text-white/60">
            Connect your wallet to access the dashboard
          </p>
        </div>

        {/* RainbowKit Connect Button */}
        <div className="flex flex-col items-center gap-6">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading'
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus || authenticationStatus === 'authenticated')

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                  className="w-full"
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          className="group relative w-full rounded-xl border border-orange-500/50 bg-orange-500 p-4 text-white font-semibold transition-all duration-300 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25"
                        >
                          <div className="flex items-center justify-center gap-3">
                            <Wallet className="h-5 w-5" />
                            Connect Wallet
                          </div>
                        </button>
                      )
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          className="w-full rounded-xl border border-red-500/50 bg-red-500/20 p-4 text-red-500 font-semibold"
                        >
                          Wrong network
                        </button>
                      )
                    }

                    return (
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={openChainModal}
                          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-white hover:bg-white/10 transition-colors"
                        >
                          {chain.hasIcon && (
                            <div
                              className="h-5 w-5 rounded-full overflow-hidden"
                              style={{ background: chain.iconBackground }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  className="h-5 w-5"
                                />
                              )}
                            </div>
                          )}
                          {chain.name}
                        </button>

                        <button
                          onClick={openAccountModal}
                          className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/50 bg-orange-500/20 p-4 text-orange-500 font-semibold hover:bg-orange-500/30 transition-colors"
                        >
                          {account.displayName}
                          {account.displayBalance ? ` (${account.displayBalance})` : ''}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            }}
          </ConnectButton.Custom>

          {/* Supported Wallets Info */}
          <div className="text-center">
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
          By connecting, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
