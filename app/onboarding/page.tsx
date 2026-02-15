'use client'

import { useRef } from 'react'
import { useAuth } from '@/context/auth-context'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default function OnboardingPage() {
  const { user, isAuthenticated, isLoading, isReady } = useAuth()
  const hasShownWizard = useRef(false)

  // Only show loading spinner on the initial load.
  // Once the wizard has been rendered, don't unmount it during re-syncs
  // (e.g. when linking a wallet triggers syncUserToDatabase).
  if (!isReady || (isLoading && !hasShownWizard.current)) {
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

  hasShownWizard.current = true
  return <OnboardingWizard />
}
