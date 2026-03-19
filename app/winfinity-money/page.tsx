'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWmAuth } from './wm-auth'
import { Loader2 } from 'lucide-react'

export default function WinfinityMoneyPage() {
  const { user, isAuthenticated, isLoading, error, login } = useWmAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/deposit')
      }
    }
  }, [isAuthenticated, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Winfinity Money</CardTitle>
          <CardDescription>
            Convert INR to Crypto instantly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button onClick={login} className="w-full" size="lg">
            Sign In
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Only existing Winfinity users can sign in
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
