'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWmAuth } from '../../wm-auth'
import { authFetch } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Copy, Check, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BankDetails {
  bankName: string
  accountNumber: string
  ifsc: string
  accountHolder: string
  upiId: string
}

interface TransactionData {
  id: string
  amountInr: string
  cryptoAmount: string
  token: string
  remark: string
  expiresAt: string
  status: string
}

function useCountdown(expiresAt: string) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const calcTimeLeft = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      return Math.max(0, Math.floor(diff / 1000))
    }

    setTimeLeft(calcTimeLeft())
    const interval = setInterval(() => {
      const left = calcTimeLeft()
      setTimeLeft(left)
      if (left <= 0) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return { timeLeft, minutes, seconds, expired: timeLeft <= 0 }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export default function PaymentPage() {
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useWmAuth()
  const router = useRouter()
  const params = useParams()
  const transactionId = params.transactionId as string

  const [transaction, setTransaction] = useState<TransactionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { data: bankDetails } = useQuery({
    queryKey: ['wm-bank-details'],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')
      const res = await authFetch('/api/winfinity-money/bank-details', token)
      if (!res.ok) throw new Error('Failed to fetch bank details')
      return res.json() as Promise<BankDetails>
    },
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/winfinity-money')
    }
  }, [authLoading, isAuthenticated, router])

  // Load transaction data from sessionStorage (set during deposit creation)
  useEffect(() => {
    const stored = sessionStorage.getItem(`wm-tx-${transactionId}`)
    if (stored) {
      setTransaction(JSON.parse(stored))
    }
    setLoading(false)
  }, [transactionId])

  // Store transaction data when navigating from deposit
  useEffect(() => {
    const handleStorage = () => {
      const stored = sessionStorage.getItem(`wm-tx-${transactionId}`)
      if (stored) setTransaction(JSON.parse(stored))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [transactionId])

  const timer = useCountdown(transaction?.expiresAt || new Date().toISOString())

  const handleAutoCancel = useCallback(async () => {
    if (!transaction) return
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      // Submit with empty UTR will fail due to expiry check on server
      await authFetch('/api/winfinity-money/submit-utr', accessToken, {
        method: 'POST',
        body: JSON.stringify({ transactionId, utr: 'expired' }),
      })
    } catch {
      // Silent fail - server will auto-cancel
    }
  }, [transaction, transactionId, getAccessToken])

  useEffect(() => {
    if (timer.expired && transaction && !submitted) {
      handleAutoCancel()
    }
  }, [timer.expired, transaction, submitted, handleAutoCancel])

  const handleSubmitUtr = async () => {
    if (!utr.trim() || utr.length < 6) {
      toast.error('Please enter a valid UTR number (at least 6 characters)')
      return
    }

    setSubmitting(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const res = await authFetch('/api/winfinity-money/submit-utr', accessToken, {
        method: 'POST',
        body: JSON.stringify({ transactionId, utr: utr.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit UTR')
        return
      }

      setSubmitted(true)
      toast.success('UTR submitted! Awaiting admin confirmation.')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Transaction not found</p>
        <Button onClick={() => router.push('/deposit')} variant="outline">
          Start New Deposit
        </Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-green-500/10 p-4">
          <Check className="size-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold">UTR Submitted</h2>
        <p className="text-center text-sm text-muted-foreground max-w-xs">
          Your payment is being verified. The admin will confirm your deposit shortly.
        </p>
        <Button onClick={() => router.push('/deposit')} variant="outline">
          New Deposit
        </Button>
      </div>
    )
  }

  if (timer.expired) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Transaction Expired</h2>
        <p className="text-center text-sm text-muted-foreground max-w-xs">
          The 5-minute window has passed. Please start a new deposit.
        </p>
        <Button onClick={() => router.push('/deposit')}>
          Start New Deposit
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timer */}
      <div className="flex items-center justify-center gap-2">
        <Clock className={`size-5 ${timer.timeLeft < 60 ? 'text-destructive' : 'text-orange-500'}`} />
        <span className={`text-2xl font-mono font-bold ${timer.timeLeft < 60 ? 'text-destructive' : ''}`}>
          {String(timer.minutes).padStart(2, '0')}:{String(timer.seconds).padStart(2, '0')}
        </span>
      </div>

      {/* Transaction Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">₹{parseFloat(transaction.amountInr).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You get</span>
              <span className="font-medium">{transaction.cryptoAmount} {transaction.token}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Bank Name', value: bankDetails?.bankName || 'Loading...' },
              { label: 'Account Holder', value: bankDetails?.accountHolder || 'Loading...' },
              { label: 'Account Number', value: bankDetails?.accountNumber || 'Loading...' },
              { label: 'IFSC Code', value: bankDetails?.ifsc || 'Loading...' },
              { label: 'UPI ID', value: bankDetails?.upiId || 'Loading...' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{value}</span>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}

            <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="text-xs text-muted-foreground mb-1">Remark (mandatory)</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-orange-500">{transaction.remark}</span>
                <CopyButton text={transaction.remark} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UTR Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit Payment Proof</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="utr">UTR / Transaction Reference Number</Label>
            <Input
              id="utr"
              placeholder="Enter UTR number"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              maxLength={30}
            />
          </div>
          <Button
            onClick={handleSubmitUtr}
            disabled={submitting || !utr.trim()}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "I've Sent the Money"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
