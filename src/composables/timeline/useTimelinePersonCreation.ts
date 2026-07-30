import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useTimelineStore } from '@/stores/timeline'
import { reportError } from '@/utils/logger'

const emptyPersonForm = () => ({ name: '', bio: '', birth_date: '', death_date: '' })

export function useTimelinePersonCreation() {
  const router = useRouter()
  const store = useTimelineStore()
  const showPersonForm = ref(false)
  const personSubmitting = ref(false)
  const personForm = ref(emptyPersonForm())
  const personTagsInput = ref('')

  const submitPerson = async () => {
    if (!personForm.value.name) return

    personSubmitting.value = true
    try {
      const tags = personTagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean)
      const created = await store.createPerson({ ...personForm.value, tags })
      showPersonForm.value = false
      personForm.value = emptyPersonForm()
      personTagsInput.value = ''
      void router.push(`/timeline/person/${created.id}`)
    } catch (error) {
      reportError(error)
    } finally {
      personSubmitting.value = false
    }
  }

  return {
    showPersonForm,
    personSubmitting,
    personForm,
    personTagsInput,
    submitPerson,
  }
}
