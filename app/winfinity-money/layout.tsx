import type { Metadata } from 'next'
import { WmProviders } from './wm-providers'

export const metadata: Metadata = {
  title: 'Winfinity Money',
  description: 'INR to Crypto Exchange',
  icons: {
    icon: '/logo.svg',
  },
}

export default function WinfinityMoneyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WmProviders>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <h1 className="text-lg font-semibold tracking-tight">
              Winfinity Money
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          {children}
        </main>
      </div>
    </WmProviders>
  )
}
