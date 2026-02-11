'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReferralPage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const code = params.code as string
    if (code) {
      localStorage.setItem('referralCode', code)
    }
    router.replace('/login')
  }, [params.code, router])

  return null
}
