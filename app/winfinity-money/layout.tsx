import type { Metadata } from 'next'
import { WmProviders } from './wm-providers'
import { WmHeader } from './wm-header'

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
      <div className="wm-theme min-h-screen bg-background text-foreground">
        <WmHeader />
        <main className="mx-auto max-w-2xl px-4 py-8">
          {children}
        </main>
      </div>
    </WmProviders>
  )
}
