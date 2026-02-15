'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { adminFetch } from '@/lib/admin-api'

interface UseAdminDataOptions {
  extraParams?: Record<string, string>
}

interface UseAdminDataReturn<T> {
  data: T[]
  isLoading: boolean
  isFetching: boolean
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
  const [page, setPage] = useState(1)

  const extraParamsKey = options?.extraParams
    ? Object.entries(options.extraParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : ''

  // Reset page to 1 when filters change
  const prevExtraParamsKeyRef = useRef(extraParamsKey)
  useEffect(() => {
    if (prevExtraParamsKeyRef.current !== extraParamsKey) {
      prevExtraParamsKeyRef.current = extraParamsKey
      setPage(1)
    }
  }, [extraParamsKey])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', endpoint, page, extraParamsKey],
    queryFn: async () => {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('No access token')
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (options?.extraParams) {
        for (const [key, value] of Object.entries(options.extraParams)) {
          if (value) params.set(key, value)
        }
      }
      const res = await adminFetch(`${endpoint}?${params}`, accessToken)
      if (!res.ok) throw new Error(`Failed to fetch ${dataKey}`)
      return res.json()
    },
    enabled: !!user.privyId,
    placeholderData: keepPreviousData,
  })

  return {
    data: data?.[dataKey] ?? [],
    isLoading,
    isFetching,
    page,
    totalPages: data?.totalPages ?? 1,
    total: data?.total ?? 0,
    setPage,
    refetch,
  }
}
