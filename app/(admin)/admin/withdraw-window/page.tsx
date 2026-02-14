'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Clock, Save, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { useToast } from '@/hooks/use-toast'

function toLocalDatetimeString(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export default function AdminWithdrawWindowPage() {
  const { getAccessToken } = useAuth()
  const { toast } = useToast()

  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchWindow = useCallback(async () => {
    setIsLoading(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch('/api/admin/withdraw-window', accessToken)
      if (res.ok) {
        const data = await res.json()
        setOpensAt(toLocalDatetimeString(data.opensAt))
        setClosesAt(toLocalDatetimeString(data.closesAt))
      }
    } catch (error) {
      console.error('Failed to fetch withdrawal window:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    fetchWindow()
  }, [fetchWindow])

  const handleSave = async () => {
    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
      toast({
        title: 'Invalid window',
        description: 'Opens At must be before Closes At',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch('/api/admin/withdraw-window', accessToken, {
        method: 'PUT',
        body: JSON.stringify({
          opensAt: opensAt ? new Date(opensAt).toISOString() : null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setOpensAt(toLocalDatetimeString(data.opensAt))
        setClosesAt(toLocalDatetimeString(data.closesAt))
        toast({ title: 'Saved', description: 'Withdrawal window updated successfully.' })
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save withdrawal window', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setIsSaving(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const res = await adminFetch('/api/admin/withdraw-window', accessToken, {
        method: 'PUT',
        body: JSON.stringify({ opensAt: null, closesAt: null }),
      })
      if (res.ok) {
        setOpensAt('')
        setClosesAt('')
        toast({ title: 'Cleared', description: 'Withdrawal window cleared. Withdrawals are now always open.' })
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to clear withdrawal window', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const getStatus = () => {
    if (!opensAt && !closesAt) return { label: 'Always Open', variant: 'open' as const }
    const now = new Date()
    const open = opensAt ? new Date(opensAt) : null
    const close = closesAt ? new Date(closesAt) : null

    let isOpen = true
    if (open && close) {
      isOpen = now >= open && now <= close
    } else if (open) {
      isOpen = now >= open
    } else if (close) {
      isOpen = now <= close
    }

    return isOpen
      ? { label: 'Open', variant: 'open' as const }
      : { label: 'Closed', variant: 'closed' as const }
  }

  const status = getStatus()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-500" />
                Withdrawal Window
              </CardTitle>
              <CardDescription className="text-white/50 mt-1">
                Set the time window during which users can submit withdrawal requests.
                When no window is set, withdrawals are always open.
              </CardDescription>
            </div>
            <Badge
              className={
                status.variant === 'open'
                  ? 'bg-green-500/20 text-green-500 border-green-500/50'
                  : 'bg-red-500/20 text-red-500 border-red-500/50'
              }
            >
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="opensAt" className="text-white/70">
                Opens At
              </Label>
              <Input
                id="opensAt"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="bg-white/5 border-white/10 text-white focus:border-red-500 [color-scheme:dark]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closesAt" className="text-white/70">
                Closes At
              </Label>
              <Input
                id="closesAt"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="bg-white/5 border-white/10 text-white focus:border-red-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {!opensAt && !closesAt && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm text-green-400">
                No window is set. Withdrawals are currently always open.
              </p>
            </div>
          )}

          {(opensAt || closesAt) && (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-1">
              {opensAt && (
                <p className="text-sm text-white/70">
                  Opens: <span className="text-white">{new Date(opensAt).toLocaleString()}</span>
                </p>
              )}
              {closesAt && (
                <p className="text-sm text-white/70">
                  Closes: <span className="text-white">{new Date(closesAt).toLocaleString()}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Window
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isSaving || (!opensAt && !closesAt)}
              className="border-white/10 text-white/70 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Window
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
