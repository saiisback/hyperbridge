'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Search, IndianRupee } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { useToast } from '@/hooks/use-toast'
import { formatINR } from '@/lib/utils'

interface UserResult {
  id: string
  name: string | null
  email: string | null
  primaryWallet: string | null
  totalBalance: string
  availableBalance: string
}

export default function AdminAddBalancePage() {
  const { getAccessToken } = useAuth()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([])
      return
    }
    setIsSearching(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`, accessToken)
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users)
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  const handleSelectUser = (user: UserResult) => {
    setSelectedUser(user)
    setSearchQuery('')
    setUsers([])
  }

  const handleSubmit = () => {
    const amt = parseFloat(amount)
    if (!selectedUser) {
      toast({ title: 'No user selected', description: 'Please search and select a user', variant: 'destructive' })
      return
    }
    if (!amt || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const res = await adminFetch('/api/admin/add-balance', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseFloat(amount),
          note: note.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Balance added',
          description: `₹${formatINR(parseFloat(amount))} added to ${selectedUser.name || selectedUser.email}. Locked for 4 months.`,
        })
        setSelectedUser(null)
        setAmount('')
        setNote('')
        setConfirmOpen(false)
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add balance', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <CardTitle className="text-white">Add Balance</CardTitle>
          <CardDescription className="text-white/50">
            Add funds to a user&apos;s account. Funds will be locked for 4 months and earn daily ROI like a normal deposit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Search */}
          <div className="space-y-2">
            <Label className="text-white/70">Select User</Label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div>
                  <p className="text-white font-medium">{selectedUser.name || 'Anonymous'}</p>
                  <p className="text-sm text-white/50">{selectedUser.email || selectedUser.primaryWallet || '-'}</p>
                  <p className="text-xs text-white/40 mt-1">
                    Balance: ₹{formatINR(parseFloat(selectedUser.totalBalance))}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                  className="border-white/10 text-white/70 hover:bg-white/10"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Search by name, email, or wallet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30" />
                )}

                {/* Search Results Dropdown */}
                {users.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-black/95 border border-white/10 rounded-lg overflow-hidden shadow-lg max-h-60 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <p className="text-white text-sm font-medium">{u.name || 'Anonymous'}</p>
                        <p className="text-xs text-white/40">
                          {u.email || u.primaryWallet || '-'} &middot; Balance: ₹{formatINR(parseFloat(u.totalBalance))}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="addAmount" className="text-white/70">Amount (INR)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="addAmount"
                type="number"
                min="0"
                step="1"
                placeholder="Enter amount in INR"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="addNote" className="text-white/70">Note (optional)</Label>
            <Input
              id="addNote"
              placeholder="Reason for adding balance..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!selectedUser || !amount || parseFloat(amount) <= 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Add Balance
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-black/95 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Balance Addition</DialogTitle>
            <DialogDescription className="text-white/50">
              This will add funds to the user&apos;s account. The amount will be locked for 4 months and will earn daily ROI (0.35%).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">User</span>
              <span className="text-white font-medium">{selectedUser?.name || selectedUser?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Amount</span>
              <span className="text-green-500 font-medium">₹{amount ? formatINR(parseFloat(amount)) : '0'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Lock Period</span>
              <span className="text-yellow-500">4 months</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Daily ROI</span>
              <span className="text-white">0.35%</span>
            </div>
            {note && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Note</span>
                <span className="text-white/70">{note}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="border-white/10 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
