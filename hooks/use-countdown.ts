'use client'

import { useState, useEffect, useRef } from 'react'

interface UseCountdownOptions {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
}

interface UseCountdownReturn {
  countdown: string
  isOpen: boolean
}

export function useCountdown(options: UseCountdownOptions): UseCountdownReturn {
  const [isOpen, setIsOpen] = useState(options.isOpen)
  const [countdown, setCountdown] = useState('')
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setIsOpen(options.isOpen)
  }, [options.isOpen])

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }

    const targetTime = isOpen ? options.closesAt : options.opensAt
    if (!targetTime) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = new Date(targetTime).getTime()
      const diff = target - now

      if (diff <= 0) {
        setCountdown('')
        setIsOpen((prev) => !prev)
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      const parts: string[] = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0) parts.push(`${hours}h`)
      if (minutes > 0) parts.push(`${minutes}m`)
      parts.push(`${seconds}s`)
      setCountdown(parts.join(' '))
    }

    updateCountdown()
    countdownRef.current = setInterval(updateCountdown, 1000)

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [isOpen, options.opensAt, options.closesAt])

  return { countdown, isOpen }
}
