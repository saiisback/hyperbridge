'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'
import { formatINR } from '@/lib/utils'

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  primaryWallet: string | null
  isActive: boolean
  kycVerified: boolean
  role: string
  createdAt: string
  totalBalance: string
  availableBalance: string
  transactionCount: number
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchUsers = useCallback(async () => {
    if (!user.privyId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (search) params.set('search', search)

      const res = await adminFetch(`/api/admin/users?${params}`, user.privyId)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user.privyId, page, search])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  function truncateAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Users ({total})</CardTitle>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-red-500 w-64"
                />
              </div>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-white/50 text-center py-8">No users found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Name</TableHead>
                    <TableHead className="text-white/50">Email</TableHead>
                    <TableHead className="text-white/50">Wallet</TableHead>
                    <TableHead className="text-white/50">Balance</TableHead>
                    <TableHead className="text-white/50">Txns</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-white/50">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white font-medium">
                        {u.name || 'Anonymous'}
                        {u.role === 'admin' && (
                          <Badge className="ml-2 bg-red-500/20 text-red-500 border-red-500/50 text-xs">
                            Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-white/70">{u.email || '-'}</TableCell>
                      <TableCell className="text-white/70 font-mono">
                        {u.primaryWallet ? truncateAddress(u.primaryWallet) : '-'}
                      </TableCell>
                      <TableCell className="text-orange-500">
                        ₹{formatINR(parseFloat(u.totalBalance))}
                      </TableCell>
                      <TableCell className="text-white/70">{u.transactionCount}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            u.isActive
                              ? 'bg-green-500/20 text-green-500 border-green-500/50'
                              : 'bg-red-500/20 text-red-500 border-red-500/50'
                          }
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/70">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-white/50">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-white/10 text-white/70 hover:bg-white/10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-white/10 text-white/70 hover:bg-white/10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
