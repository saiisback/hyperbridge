'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  User,
  Shield,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
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
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around h-16">
        {navigationItems.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link
              key={item.title}
              href={item.url}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive
                  ? 'text-orange-500'
                  : 'text-white/50 active:text-white/70'
              )}
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          )
        })}
        {user.isAdmin && (
          <Link
            href="/admin"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors text-red-500/70 active:text-red-500"
          >
            <Shield className="size-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
