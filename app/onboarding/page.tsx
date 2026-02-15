'use client'

import { useAuth } from '@/context/auth-context'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default function OnboardingPage() {
  const { user, isAuthenticated, isLoading, isReady } = useAuth()

  if (!isReady || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (user.onboardingCompleted) {
    return null
  }

  return <OnboardingWizard />
}
