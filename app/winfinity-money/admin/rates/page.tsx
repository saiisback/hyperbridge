'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWmAuth } from '../../wm-auth'
import { authFetch } from '@/lib/api'
import { Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function RatesPage() {
  const { user, isAuthenticated, isLoading: authLoading, getAccessToken } = useWmAuth()
  const router = useRouter()
  const [ethRate, setEthRate] = useState('')
  const [usdtRate, setUsdtRate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user && user.role !== 'admin'))) {
      router.push('/winfinity-money')
    }
  }, [authLoading, isAuthenticated, user, router])

  const { data: rates, isLoading } = useQuery({
    queryKey: ['wm-rates-admin'],
    queryFn: async () => {
      const res = await fetch('/api/winfinity-money/rates')
      if (!res.ok) return null
      return res.json() as Promise<{ ethRate: string; usdtRate: string; updatedAt: string }>
    },
    enabled: isAuthenticated && user?.role === 'admin',
  })

  useEffect(() => {
    if (rates) {
      setEthRate(rates.ethRate)
      setUsdtRate(rates.usdtRate)
    }
  }, [rates])

  const handleSave = async () => {
    const eth = parseFloat(ethRate)
    const usdt = parseFloat(usdtRate)

    if (!eth || eth <= 0 || !usdt || usdt <= 0) {
      toast.error('Please enter valid positive rates')
      return
    }

    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const res = await authFetch('/api/winfinity-money/admin/rates', token, {
        method: 'PUT',
        body: JSON.stringify({ ethRate: eth, usdtRate: usdt }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update rates')
        return
      }

      toast.success('Rates updated')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-xl font-semibold">Exchange Rates</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set Conversion Rates</CardTitle>
          <CardDescription>
            INR amount per 1 unit of crypto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ethRate">1 ETH = ₹</Label>
            <Input
              id="ethRate"
              type="number"
              placeholder="250000"
              value={ethRate}
              onChange={(e) => setEthRate(e.target.value)}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usdtRate">1 USDT = ₹</Label>
            <Input
              id="usdtRate"
              type="number"
              placeholder="93"
              value={usdtRate}
              onChange={(e) => setUsdtRate(e.target.value)}
              min={0}
            />
          </div>

          {rates?.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(rates.updatedAt).toLocaleString()}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save Rates'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
