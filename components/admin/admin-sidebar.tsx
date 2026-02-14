'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield,
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  ArrowUpFromLine,
  Clock,
  ArrowLeft,
  LogOut,
  ChevronUp,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    title: 'Overview',
    url: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    url: '/admin/users',
    icon: Users,
  },
  {
    title: 'Transactions',
    url: '/admin/transactions',
    icon: ArrowLeftRight,
  },
  {
    title: 'Withdrawals',
    url: '/admin/withdrawals',
    icon: ArrowUpFromLine,
  },
  {
    title: 'Withdraw Window',
    url: '/admin/withdraw-window',
    icon: Clock,
  },
]

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const displayName = user.name || 'Admin'
  const address = user.primaryWallet
  const email = user.email

  const getInitials = () => {
    if (user.name) {
      return user.name.slice(0, 2).toUpperCase()
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'AD'
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shadow-red-600/25">
                  <Shield className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-white">HyperBridge</span>
                  <span className="text-xs text-white/50">Admin Panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        'transition-all duration-200',
                        isActive && [
                          'bg-red-600/20 text-red-500',
                          'shadow-[0_0_20px_rgba(220,38,38,0.25)]',
                          'hover:bg-red-600/30 hover:text-red-400',
                        ]
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon
                          className={cn(
                            'transition-colors',
                            isActive ? 'text-red-500' : 'text-white/70'
                          )}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to Dashboard">
                  <Link href="/dashboard" className="text-white/50 hover:text-white">
                    <ArrowLeft className="text-white/50" />
                    <span>Back to Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg border border-red-500/50">
                    <AvatarFallback className="rounded-lg bg-red-600/20 text-red-500 text-xs">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-white">
                      {displayName}
                    </span>
                    <span className="truncate text-xs text-white/50">
                      {address ? truncateAddress(address) : email || 'Admin'}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 text-white/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-black/95 border-white/10"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard"
                    className="gap-2 p-2 text-white/70 focus:bg-white/10 focus:text-white cursor-pointer"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2 p-2 text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
