'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'

interface UseAdminDataOptions {
  extraParams?: Record<string, string>
}

interface UseAdminDataReturn<T> {
  data: T[]
  isLoading: boolean
  page: number
  totalPages: number
  total: number
  setPage: (page: number | ((prev: number) => number)) => void
  refetch: () => void
}

export function useAdminData<T>(
  endpoint: string,
  dataKey: string,
  options?: UseAdminDataOptions
): UseAdminDataReturn<T> {
  const { user, getAccessToken } = useAuth()
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const extraParamsKey = options?.extraParams
    ? Object.entries(options.extraParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : ''

  const fetchData = useCallback(async () => {
    if (!user.privyId) return
    setIsLoading(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (options?.extraParams) {
        for (const [key, value] of Object.entries(options.extraParams)) {
          if (value) params.set(key, value)
        }
      }

      const res = await adminFetch(`${endpoint}?${params}`, accessToken)
      if (res.ok) {
        const result = await res.json()
        setData(result[dataKey])
        setTotalPages(result.totalPages)
        setTotal(result.total)
      }
    } catch (error) {
      console.error(`Failed to fetch ${dataKey}:`, error)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.privyId, page, extraParamsKey, getAccessToken, endpoint, dataKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, page, totalPages, total, setPage, refetch: fetchData }
}
