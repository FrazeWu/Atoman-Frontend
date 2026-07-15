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

function clearLegacyCompletedAt(user: User | null) {
  const key = resolveCompletedStorageKey(user)
  if (!key) return
  localStorage.removeItem(key)
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && onboardingSteps.includes(value as OnboardingStep)
}

function isValidRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = offsetHourText ? Number(offsetHourText) : 0
  const offsetMinute = offsetMinuteText ? Number(offsetMinuteText) : 0

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  if (offsetHour > 23 || offsetMinute > 59) return false

  return !Number.isNaN(Date.parse(value))
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const isVisible = ref(false)
  const currentStep = ref<OnboardingStep>('overview')
  const initialized = ref(false)
  const initializedForUserKey = ref<string | null>(null)
  const completing = ref(false)
  let completionRequestSequence = 0

  const stepIndex = computed(() => onboardingSteps.indexOf(currentStep.value))
  const isLastStep = computed(() => currentStep.value === onboardingSteps[onboardingSteps.length - 1])

  const reset = () => {
    completionRequestSequence += 1
    isVisible.value = false
    currentStep.value = 'overview'
    initialized.value = false
    initializedForUserKey.value = null
    completing.value = false
  }

  const initialize = (user = authStore.user, handoffStep?: OnboardingStep | null) => {
    const userKey = resolveUserKey(user)
    if (!userKey) {
      reset()
      return
    }

    clearLegacyCompletedAt(user)
    if (initializedForUserKey.value && initializedForUserKey.value !== userKey) {
      completionRequestSequence += 1
      completing.value = false
    }

    const completedAt = user.onboarding_completed_at
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

    const existingCompletedAt = authStore.user.onboarding_completed_at
    if (existingCompletedAt) {
      isVisible.value = false
      return
    }

    const userKey = resolveUserKey(authStore.user)
    if (!userKey) return
    const requestSequence = ++completionRequestSequence
    completing.value = true
    try {
      const response = await fetch(api.auth.onboardingComplete, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        credentials: 'include',
      })

      if (!response.ok) return
      const data = await response.json()
      const completedAt = data.onboarding_completed_at || data.data?.onboarding_completed_at
      if (!isValidRfc3339DateTime(completedAt)) return
      if (requestSequence !== completionRequestSequence || resolveUserKey(authStore.user) !== userKey) return

      authStore.updateUser({ onboarding_completed_at: completedAt })
      isVisible.value = false
    } catch {
      // Keep the current step visible so the user can retry.
    } finally {
      if (requestSequence === completionRequestSequence) completing.value = false
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
