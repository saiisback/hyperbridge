'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { useAuth } from '@/context/auth-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading, isReady } = useAuth()
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
  }, [isReady, isLoading, isAuthenticated, router])

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
      <AppSidebar />
      <SidebarInset className="bg-black rounded-xl m-2 ml-0 overflow-hidden border border-white/10 max-h-[calc(100vh-1rem)] flex flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
