import { describe, expect, it, vi } from 'vitest'

import { useMediaCreationSteps } from '@/composables/useMediaCreationSteps'

describe('useMediaCreationSteps', () => {
  it('advances only after each step validator succeeds', () => {
    const validateMedia = vi.fn(() => false)
    const validateInformation = vi.fn(() => false)
    const steps = useMediaCreationSteps({
      isEditing: false,
      validateMedia,
      validateInformation,
    })

    steps.goNext()
    expect(steps.currentStep.value).toBe(1)
    expect(steps.maxStep.value).toBe(1)

    validateMedia.mockReturnValue(true)
    steps.goNext()
    expect(steps.currentStep.value).toBe(2)
    expect(steps.maxStep.value).toBe(2)

    steps.goNext()
    expect(steps.currentStep.value).toBe(2)

    validateInformation.mockReturnValue(true)
    steps.goNext()
    expect(steps.currentStep.value).toBe(3)
    expect(steps.maxStep.value).toBe(3)

    steps.goPrevious()
    steps.goPrevious()
    steps.goPrevious()
    expect(steps.currentStep.value).toBe(1)
  })

  it('starts edited content on the information step', () => {
    const steps = useMediaCreationSteps({
      isEditing: true,
      validateMedia: () => true,
      validateInformation: () => true,
    })

    expect(steps.currentStep.value).toBe(2)
    expect(steps.maxStep.value).toBe(2)
  })
})
