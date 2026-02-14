'use client'

import { useState } from 'react'
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
import { useAdminData } from '@/hooks/use-admin-data'
import { formatINR, truncateAddress } from '@/lib/utils'

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
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const extraParams = searchQuery ? { search: searchQuery } : undefined
  const { data: users, isLoading, page, totalPages, total, setPage } = useAdminData<AdminUser>(
    '/api/admin/users',
    'users',
    { extraParams }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(search)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black/50 backdrop-blur-sm border-white/10 rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-white">Users ({total})</CardTitle>
            <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-red-500 w-full"
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
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">Name</TableHead>
                      <TableHead className="text-white/50 hidden sm:table-cell">Email</TableHead>
                      <TableHead className="text-white/50 hidden md:table-cell">Wallet</TableHead>
                      <TableHead className="text-white/50">Balance</TableHead>
                      <TableHead className="text-white/50 hidden sm:table-cell">Txns</TableHead>
                      <TableHead className="text-white/50">Status</TableHead>
                      <TableHead className="text-white/50 hidden md:table-cell">Joined</TableHead>
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
                        <TableCell className="text-white/70 hidden sm:table-cell">{u.email || '-'}</TableCell>
                        <TableCell className="text-white/70 font-mono hidden md:table-cell">
                          {u.primaryWallet ? truncateAddress(u.primaryWallet) : '-'}
                        </TableCell>
                        <TableCell className="text-orange-500">
                          ₹{formatINR(parseFloat(u.totalBalance))}
                        </TableCell>
                        <TableCell className="text-white/70 hidden sm:table-cell">{u.transactionCount}</TableCell>
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
                        <TableCell className="text-white/70 hidden md:table-cell">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
