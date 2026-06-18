import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'

export const onboardingSteps = ['overview', 'modules', 'feed-entry', 'feed-subscribe'] as const

export type OnboardingStep = typeof onboardingSteps[number]

const completedStoragePrefix = 'atoman_onboarding_completed_at:'

function resolveUserKey(user: User | null) {
  if (!user) return null
  return user.uuid || user.id?.toString() || user.username
}

function resolveCompletedStorageKey(user: User | null) {
  const userKey = resolveUserKey(user)
  return userKey ? `${completedStoragePrefix}${userKey}` : null
}

function readLocalCompletedAt(user: User | null) {
  const key = resolveCompletedStorageKey(user)
  if (!key) return null
  return localStorage.getItem(key)
}

function rememberLocalCompletedAt(user: User | null, completedAt: string) {
  const key = resolveCompletedStorageKey(user)
  if (!key) return
  localStorage.setItem(key, completedAt)
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && onboardingSteps.includes(value as OnboardingStep)
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

  const applyLocalCompletion = (user: User) => {
    const completedAt = user.onboarding_completed_at || readLocalCompletedAt(user)
    if (!completedAt) return null

    rememberLocalCompletedAt(user, completedAt)
    if (!user.onboarding_completed_at) {
      authStore.updateUser({ onboarding_completed_at: completedAt })
    }
    return completedAt
  }

  const initialize = (user = authStore.user, handoffStep?: OnboardingStep | null) => {
    const userKey = resolveUserKey(user)
    if (!userKey) {
      reset()
      return
    }

    const completedAt = applyLocalCompletion(user)
    if (completedAt) {
      initialized.value = true
      initializedForUserKey.value = userKey
      isVisible.value = false
      currentStep.value = 'overview'
      return
    }

    const hasHandoffStep = isOnboardingStep(handoffStep)
    if (initialized.value && initializedForUserKey.value === userKey && !hasHandoffStep) {
      return
    }

    initialized.value = true
    initializedForUserKey.value = userKey
    currentStep.value = hasHandoffStep ? handoffStep : 'overview'
    isVisible.value = true
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

    const existingCompletedAt = authStore.user.onboarding_completed_at || readLocalCompletedAt(authStore.user)
    if (existingCompletedAt) {
      rememberLocalCompletedAt(authStore.user, existingCompletedAt)
      authStore.updateUser({ onboarding_completed_at: existingCompletedAt })
      isVisible.value = false
      return
    }

    completing.value = true
    let completedAt = new Date().toISOString()
    rememberLocalCompletedAt(authStore.user, completedAt)
    authStore.updateUser({ onboarding_completed_at: completedAt })
    isVisible.value = false
    try {
      const response = await fetch(api.auth.onboardingComplete, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        completedAt = data.onboarding_completed_at || data.data?.onboarding_completed_at || completedAt
        rememberLocalCompletedAt(authStore.user, completedAt)
        authStore.updateUser({ onboarding_completed_at: completedAt })
      }
    } catch {
      // The user already completed or skipped the guide. Keep this browser session
      // closed even if the server write cannot be confirmed.
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
