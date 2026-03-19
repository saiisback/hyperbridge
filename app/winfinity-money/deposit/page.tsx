'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWmAuth } from '../wm-auth'
import { authFetch } from '@/lib/api'
import { Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function DepositPage() {
  const { user, isAuthenticated, isLoading: authLoading, getAccessToken } = useWmAuth()
  const router = useRouter()
  const [amountInr, setAmountInr] = useState('')
  const [token, setToken] = useState<'ETH' | 'USDT'>('USDT')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/winfinity-money')
    }
  }, [authLoading, isAuthenticated, router])

  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ['wm-rates'],
    queryFn: async () => {
      const res = await fetch('/api/winfinity-money/rates')
      if (!res.ok) throw new Error('Failed to fetch rates')
      return res.json() as Promise<{ ethRate: string; usdtRate: string }>
    },
    enabled: isAuthenticated,
  })

  const amount = parseFloat(amountInr) || 0
  const rate = rates ? (token === 'ETH' ? parseFloat(rates.ethRate) : parseFloat(rates.usdtRate)) : 0
  const cryptoAmount = rate > 0 ? amount / rate : 0

  const handleDeposit = async () => {
    if (amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const res = await authFetch('/api/winfinity-money/deposit', accessToken, {
        method: 'POST',
        body: JSON.stringify({ amountInr: amount, token }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create deposit')
        return
      }

      // Store transaction data for the payment page
      sessionStorage.setItem(
        `wm-tx-${data.transaction.id}`,
        JSON.stringify(data.transaction)
      )
      router.push(`/payment/${data.transaction.id}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">New Deposit</h2>
        <p className="text-sm text-muted-foreground">
          Enter INR amount and select crypto
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount">INR Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                ₹
              </span>
              <Input
                id="amount"
                type="number"
                placeholder="10,000"
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
                className="pl-7"
                min={0}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Crypto</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['USDT', 'ETH'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors ${
                    token === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {ratesLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : rates && amount > 0 ? (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {token} = ₹{rate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">You get</span>
                <span>{cryptoAmount.toFixed(token === 'USDT' ? 2 : 8)} {token}</span>
              </div>
            </div>
          ) : !rates ? (
            <p className="text-sm text-destructive">Exchange rates not available. Contact admin.</p>
          ) : null}

          <Button
            onClick={handleDeposit}
            disabled={submitting || amount <= 0 || !rates}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Start Deposit
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
