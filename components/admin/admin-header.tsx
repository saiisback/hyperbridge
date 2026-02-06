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

function getPageTitle(pathname: string): string {
  const routes: Record<string, string> = {
    '/admin': 'Overview',
    '/admin/users': 'Users',
    '/admin/transactions': 'Transactions',
    '/admin/withdrawals': 'Withdrawals',
  }
  return routes[pathname] || 'Admin'
}

export function AdminHeader() {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4 bg-black/50 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1 text-white/70 hover:text-white hover:bg-white/10" />
      <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink
              href="/admin"
              className="text-white/50 hover:text-white transition-colors"
            >
              Admin Panel
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
