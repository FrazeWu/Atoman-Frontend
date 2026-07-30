import { ref } from 'vue'

type MediaCreationStep = 1 | 2 | 3

type MediaCreationStepOptions = {
  isEditing: boolean
  validateMedia: () => boolean
  validateInformation: () => boolean
}

const creationSteps = [
  { value: 1, label: '媒体', description: '选择来源并上传' },
  { value: 2, label: '信息', description: '填写内容资料' },
  { value: 3, label: '发布', description: '检查并确认' },
]

export function useMediaCreationSteps(options: MediaCreationStepOptions) {
  const initialStep: MediaCreationStep = options.isEditing ? 2 : 1
  const currentStep = ref<MediaCreationStep>(initialStep)
  const maxStep = ref<MediaCreationStep>(initialStep)

  function goNext() {
    if (currentStep.value === 1) {
      if (!options.validateMedia()) return
      maxStep.value = Math.max(maxStep.value, 2) as MediaCreationStep
      currentStep.value = 2
      return
    }
    if (currentStep.value === 2 && options.validateInformation()) {
      maxStep.value = 3
      currentStep.value = 3
    }
  }

  function goPrevious() {
    currentStep.value = Math.max(1, currentStep.value - 1) as MediaCreationStep
  }

  return {
    creationSteps,
    currentStep,
    maxStep,
    goNext,
    goPrevious,
  }
}
