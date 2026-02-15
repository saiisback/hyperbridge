'use client'

import { useState } from 'react'
import { useAuthActions, useAuthState } from '@/context/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ShimmerButton } from '@/components/shimmer-button'
import { User } from 'lucide-react'

interface SetUsernameStepProps {
  onComplete: () => void
}

export function SetUsernameStep({ onComplete }: SetUsernameStepProps) {
  const { user } = useAuthState()
  const { updateProfile } = useAuthActions()
  const [name, setName] = useState(user.name || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Username is required')
      return
    }
    if (trimmed.length > 100) {
      setError('Username must be 100 characters or less')
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      await updateProfile({ name: trimmed })
      onComplete()
    } catch {
      setError('Failed to update username. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
            <User className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-white">Set Your Username</CardTitle>
            <CardDescription className="text-white/50">
              Choose a display name for your account
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Enter your username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>
          <ShimmerButton
            shimmerColor="#ffffff"
            shimmerSize="0.05em"
            shimmerDuration="3s"
            borderRadius="12px"
            background="rgba(249, 115, 22, 1)"
            className="w-full py-3 font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </ShimmerButton>
        </form>
      </CardContent>
    </Card>
  )
}
