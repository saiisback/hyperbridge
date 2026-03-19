'use client'

import { useWmAuth } from './wm-auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function WmHeader() {
  const { isAuthenticated, logout } = useWmAuth()

  return (
    <header className="border-b border-border/40">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <h1 className="text-lg font-semibold tracking-tight text-primary">
          Winfinity Money
        </h1>
        {isAuthenticated && (
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" />
            Logout
          </Button>
        )}
      </div>
    </header>
  )
}
