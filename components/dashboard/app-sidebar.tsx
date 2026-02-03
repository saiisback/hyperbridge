'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  User,
  Users,
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
import { useWallet } from '@/hooks/use-wallet'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Wallet',
    url: '/wallet',
    icon: Wallet,
  },
  {
    title: 'Income',
    url: '/income',
    icon: TrendingUp,
  },
  {
    title: 'Profile',
    url: '/profile',
    icon: User,
  },
  {
    title: 'Team',
    url: '/team',
    icon: Users,
  },
]

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function AppSidebar() {
  const pathname = usePathname()
  const { address, disconnect } = useWallet()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                  <Wallet className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-white">HyperBridge</span>
                  <span className="text-xs text-white/50">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50">
            Navigation
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
                          'bg-orange-500/20 text-orange-500',
                          'shadow-[0_0_20px_rgba(249,115,22,0.25)]',
                          'hover:bg-orange-500/30 hover:text-orange-400',
                        ]
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon
                          className={cn(
                            'transition-colors',
                            isActive ? 'text-orange-500' : 'text-white/70'
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
                  <Avatar className="size-8 rounded-lg border border-orange-500/50">
                    <AvatarFallback className="rounded-lg bg-orange-500/20 text-orange-500 text-xs">
                      {address?.slice(2, 4).toUpperCase() || 'XX'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-white">
                      Connected
                    </span>
                    <span className="truncate text-xs text-white/50">
                      {address ? truncateAddress(address) : 'Not connected'}
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
                <DropdownMenuItem className="gap-2 p-2 text-white/70 focus:bg-white/10 focus:text-white">
                  <div className="flex size-6 items-center justify-center rounded-md border border-white/10 bg-white/5">
                    <User className="size-4" />
                  </div>
                  <span className="font-mono text-xs">
                    {address ? truncateAddress(address) : 'Not connected'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={disconnect}
                  className="gap-2 p-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                >
                  <LogOut className="size-4" />
                  Disconnect Wallet
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
