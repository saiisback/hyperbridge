'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useAuth } from '@/context/auth-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading, isReady, user } = useAuth()
  const router = useRouter()
  const wasAuthenticated = useRef(false)

  // Track if user was ever authenticated to prevent redirect on brief flickers
  if (isAuthenticated) {
    wasAuthenticated.current = true
  }

  useEffect(() => {
    // Only redirect if Privy is fully ready, not loading, not authenticated,
    // AND the user was never authenticated in this session (prevents flicker redirects)
    if (isReady && !isLoading && !isAuthenticated && !wasAuthenticated.current) {
      router.push('/login')
    }

    // Redirect to onboarding if user hasn't completed it (only when dbUser is loaded)
    if (isReady && !isLoading && isAuthenticated && user.dbUser && !user.onboardingCompleted) {
      router.push('/onboarding')
    }
  }, [isReady, isLoading, isAuthenticated, user.dbUser, user.onboardingCompleted, router])

  if (!isReady || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <SidebarProvider>
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <SidebarInset className="bg-black rounded-xl m-2 ml-0 overflow-hidden border border-white/10 flex flex-col max-h-[calc(100vh-1rem-4rem)] md:max-h-[calc(100vh-1rem)]">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  )
}
