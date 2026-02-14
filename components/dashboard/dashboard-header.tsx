'use client'

import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { useWallet } from '@/hooks/use-wallet'

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getPageTitle(pathname: string): string {
  const routes: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/wallet': 'Wallet',
    '/income': 'Income',
    '/profile': 'Profile',
  }
  return routes[pathname] || 'Dashboard'
}

export function DashboardHeader() {
  const pathname = usePathname()
  const { address, isConnected } = useWallet()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4 bg-black/50 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1 text-white/70 hover:text-white hover:bg-white/10" />
      <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink
              href="/dashboard"
              className="text-white/50 hover:text-white transition-colors"
            >
              Winfinitty
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block text-white/30" />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white font-medium">
              {pageTitle}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

    </header>
  )
}
