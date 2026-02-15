'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthActions } from '@/context/auth-context'
import { Progress } from '@/components/ui/progress'
import { SetUsernameStep } from '@/components/onboarding/steps/set-username-step'
import { AddWalletStep } from '@/components/onboarding/steps/add-wallet-step'

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const { updateProfile } = useAuthActions()
  const router = useRouter()

  const handleComplete = async () => {
    await updateProfile({ onboardingCompleted: true })
    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-orange-600/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-orange-500/20 p-4 border border-orange-500/30">
            <img
              src="/logo.svg"
              alt="Winfinitty Logo"
              className="h-10 w-10 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome to Win<span className="text-orange-500">finitty</span>
          </h1>
          <p className="mt-2 text-white/60">Let&apos;s get you set up</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-white/50 mb-2">
            <span>Step {currentStep} of 2</span>
            <span>{currentStep === 1 ? 'Set Username' : 'Add Wallet'}</span>
          </div>
          <Progress value={currentStep * 50} />
        </div>

        {/* Steps */}
        {currentStep === 1 ? (
          <SetUsernameStep onComplete={() => setCurrentStep(2)} />
        ) : (
          <AddWalletStep onComplete={handleComplete} />
        )}
      </div>
    </div>
  )
}
