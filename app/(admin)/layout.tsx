'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { useAuth } from '@/context/auth-context'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const { user, isAuthenticated, isLoading, isReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isReady && !isLoading) {
      if (!isAuthenticated) {
        router.push('/login')
      } else if (user.role !== 'admin') {
        router.push('/dashboard')
      }
    }
  }, [mounted, isReady, isLoading, isAuthenticated, user.role, router])

  if (!mounted || !isReady || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="text-white/60">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user.role !== 'admin') {
    return null
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="bg-black rounded-xl m-2 ml-0 overflow-hidden border border-white/10 max-h-[calc(100vh-1rem)] flex flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
