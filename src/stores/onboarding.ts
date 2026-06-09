import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'

export const onboardingSteps = ['overview', 'modules', 'feed-entry', 'feed-subscribe'] as const

export type OnboardingStep = typeof onboardingSteps[number]

function resolveUserKey(user: User | null) {
  if (!user) return null
  return user.uuid || user.id?.toString() || user.username
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const isVisible = ref(false)
  const currentStep = ref<OnboardingStep>('overview')
  const initialized = ref(false)
  const initializedForUserKey = ref<string | null>(null)
  const completing = ref(false)

  const stepIndex = computed(() => onboardingSteps.indexOf(currentStep.value))
  const isLastStep = computed(() => currentStep.value === onboardingSteps[onboardingSteps.length - 1])

  const reset = () => {
    isVisible.value = false
    currentStep.value = 'overview'
    initialized.value = false
    initializedForUserKey.value = null
    completing.value = false
  }

  const initialize = (user = authStore.user) => {
    const userKey = resolveUserKey(user)
    if (!userKey) {
      reset()
      return
    }

    if (initialized.value && initializedForUserKey.value === userKey) {
      return
    }

    initialized.value = true
    initializedForUserKey.value = userKey
    currentStep.value = 'overview'
    isVisible.value = !user?.onboarding_completed_at
  }

  const nextStep = () => {
    const index = onboardingSteps.indexOf(currentStep.value)
    if (index < 0 || index >= onboardingSteps.length - 1) return
    currentStep.value = onboardingSteps[index + 1]
  }

  const skip = async () => {
    await complete()
  }

  const complete = async () => {
    if (completing.value) return
    if (!authStore.isAuthenticated || !authStore.user) {
      reset()
      return
    }

    if (authStore.user.onboarding_completed_at) {
      isVisible.value = false
      return
    }

    completing.value = true
    try {
      const response = await fetch(api.auth.onboardingComplete, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        credentials: 'include',
      })

      let completedAt = new Date().toISOString()
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        completedAt = data.onboarding_completed_at || data.data?.onboarding_completed_at || completedAt
      }

      authStore.updateUser({ onboarding_completed_at: completedAt })
      isVisible.value = false
    } finally {
      completing.value = false
    }
  }

  const handleSubscriptionSuccess = async () => {
    if (currentStep.value !== 'feed-subscribe') return
    await complete()
  }

  return {
    onboardingSteps,
    isVisible,
    currentStep,
    initialized,
    completing,
    stepIndex,
    isLastStep,
    initialize,
    nextStep,
    skip,
    complete,
    handleSubscriptionSuccess,
    reset,
  }
})
