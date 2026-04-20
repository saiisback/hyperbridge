'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Trash2, Copy, CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { useToast } from '@/hooks/use-toast'
import { formatINR, truncateAddress, formatDate } from '@/lib/utils'

interface UserDetail {
  user: {
    id: string
    name: string | null
    email: string | null
    primaryWallet: string | null
    avatarUrl: string | null
    isActive: boolean
    kycVerified: boolean
    role: string
    onboardingCompleted: boolean
    createdAt: string
    lastLoginAt: string | null
  }
  balances: {
    totalBalance: string
    availableBalance: string
    roiBalance: string
    totalInvested: string
  }
  transactionStats: {
    total: number
    byType: Record<
      string,
      {
        count: number
        totalAmount: string
        totalAmountInr: string
        completed: number
        pending: number
        failed: number
      }
    >
  }
  recentTransactions: Array<{
    id: string
    type: string
    amount: string
    amountInr: string | null
    token: string | null
    status: string
    txHash: string | null
    createdAt: string
  }>
  referral: {
    referralCode: string | null
    referrer: { id: string; name: string | null; email: string | null } | null
    refereeCount: number
    totalReferralEarnings: string
  }
}

interface Props {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function UserDetailSheet({ userId, open, onOpenChange, onDeleted }: Props) {
  const { getAccessToken } = useAuth()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, isLoading, error } = useQuery<UserDetail>({
    queryKey: ['admin', 'user', userId],
    queryFn: async () => {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token')
      const res = await adminFetch(`/api/admin/users/${userId}`, token)
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    enabled: !!userId && open,
  })

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false)
      setConfirmInput('')
    }
  }, [open])

  const expectedConfirm = data?.user.email ?? 'anonymous'
  const canDelete = confirmInput.trim() === expectedConfirm && !deleting

  const handleDelete = async () => {
    if (!userId || !canDelete) return
    setDeleting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token')
      const res = await adminFetch(`/api/admin/users/${userId}`, token, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to delete user')
      }
      toast({ title: 'User deleted', description: 'The user and all related data were removed.' })
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyWallet = async () => {
    if (!data?.user.primaryWallet) return
    await navigator.clipboard.writeText(data.user.primaryWallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl bg-black border-white/10 text-white overflow-y-auto p-0">
          <SheetHeader className="p-6 border-b border-white/10">
            <SheetTitle className="text-white">User Details</SheetTitle>
            <SheetDescription className="text-white/50">
              Full profile, balances, and activity.
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-6">
            {isLoading && <DetailSkeleton />}
            {error && (
              <p className="text-red-500 text-sm">Failed to load user details.</p>
            )}
            {data && (
              <>
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">Profile</h3>
                  <div className="space-y-2 text-sm">
                    <InfoRow label="Name" value={data.user.name || 'Anonymous'} />
                    <InfoRow label="Email" value={data.user.email || '-'} />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-white/50">Wallet</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-white/80">
                          {data.user.primaryWallet
                            ? truncateAddress(data.user.primaryWallet)
                            : '-'}
                        </span>
                        {data.user.primaryWallet && (
                          <button
                            onClick={handleCopyWallet}
                            className="text-white/50 hover:text-white transition-colors"
                          >
                            {copied ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/50">Status</span>
                      <div className="flex gap-2">
                        <Badge
                          className={
                            data.user.isActive
                              ? 'bg-green-500/20 text-green-500 border-green-500/50'
                              : 'bg-red-500/20 text-red-500 border-red-500/50'
                          }
                        >
                          {data.user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {data.user.kycVerified && (
                          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/50">
                            KYC
                          </Badge>
                        )}
                        {data.user.role === 'admin' && (
                          <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                    <InfoRow label="Onboarded" value={data.user.onboardingCompleted ? 'Yes' : 'No'} />
                    <InfoRow label="Joined" value={formatDate(data.user.createdAt)} />
                    <InfoRow
                      label="Last login"
                      value={data.user.lastLoginAt ? formatDate(data.user.lastLoginAt) : 'Never'}
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">Balances</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total" value={`₹${formatINR(parseFloat(data.balances.totalBalance))}`} />
                    <StatCard
                      label="Available"
                      value={`₹${formatINR(parseFloat(data.balances.availableBalance))}`}
                    />
                    <StatCard label="ROI" value={`₹${formatINR(parseFloat(data.balances.roiBalance))}`} />
                    <StatCard
                      label="Invested"
                      value={`₹${formatINR(parseFloat(data.balances.totalInvested))}`}
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">
                    Transaction Stats ({data.transactionStats.total})
                  </h3>
                  <div className="space-y-2">
                    {(['deposit', 'withdraw', 'roi', 'referral'] as const).map((key) => {
                      const s = data.transactionStats.byType[key]
                      if (!s) return null
                      const isInr = key === 'deposit' || key === 'withdraw'
                      const displayAmount = isInr
                        ? `₹${formatINR(parseFloat(s.totalAmountInr))}`
                        : `${formatINR(parseFloat(s.totalAmount))}`
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium capitalize text-white">{key}</p>
                            <p className="text-xs text-white/50">
                              {s.count} total · {s.completed} ok · {s.pending} pending · {s.failed} failed
                            </p>
                          </div>
                          <span className="text-sm font-mono text-orange-500">{displayAmount}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">
                    Recent Transactions
                  </h3>
                  {data.recentTransactions.length === 0 ? (
                    <p className="text-sm text-white/50">No transactions yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {data.recentTransactions.map((t) => {
                        const isInr = t.type === 'deposit' || t.type === 'withdraw'
                        const amount = isInr && t.amountInr
                          ? `₹${formatINR(parseFloat(t.amountInr))}`
                          : `${formatINR(parseFloat(t.amount))}${t.token ? ` ${t.token}` : ''}`
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between py-1.5 text-sm border-b border-white/5 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="capitalize text-white/80">{t.type}</span>
                              <StatusDot status={t.status} />
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-white/90">{amount}</p>
                              <p className="text-xs text-white/40">
                                {new Date(t.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">Referral</h3>
                  <div className="space-y-2 text-sm">
                    <InfoRow label="Referral code" value={data.referral.referralCode || '-'} />
                    <InfoRow
                      label="Referred by"
                      value={
                        data.referral.referrer
                          ? data.referral.referrer.name || data.referral.referrer.email || '-'
                          : '-'
                      }
                    />
                    <InfoRow label="Referees" value={String(data.referral.refereeCount)} />
                    <InfoRow
                      label="Total earnings"
                      value={`₹${formatINR(parseFloat(data.referral.totalReferralEarnings))}`}
                    />
                  </div>
                </section>
              </>
            )}
          </div>

          <SheetFooter className="p-6 border-t border-white/10">
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={!data}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-black border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will permanently delete {data?.user.name || 'this user'} along with all
              transactions, wallets, profile, and referrals. This cannot be undone.
              <br />
              <br />
              Type <span className="font-mono text-red-500">{expectedConfirm}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={expectedConfirm}
            className="bg-white/5 border-white/10 text-white font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              className="bg-transparent border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="text-white/90 text-right break-all">{value}</span>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-base font-semibold text-orange-500 mt-0.5">{value}</p>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' ? 'bg-green-500' : status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={status} />
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32 bg-white/10" />
      <Skeleton className="h-32 w-full bg-white/10" />
      <Skeleton className="h-24 w-full bg-white/10" />
      <Skeleton className="h-40 w-full bg-white/10" />
    </div>
  )
}
