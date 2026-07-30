import { ref, type Ref } from 'vue'

import { useTimelineStore } from '@/stores/timeline'
import type { TimelineEvent } from '@/types'
import { reportError } from '@/utils/logger'

interface TimelineEventEditorOptions {
  events: Ref<TimelineEvent[]>
  setActiveCompare: (id: string) => void
  upsertHydratedEvent: (event: TimelineEvent) => void
  removeHydratedEvent: (id: string) => void
  removeCompareId: (id: string) => void
  fetchEventById: (id: string) => Promise<TimelineEvent | null>
}

const emptyForm = () => ({
  title: '',
  event_date: '',
  end_date: '',
  location: '',
  latitude: null as number | null,
  longitude: null as number | null,
  source: '',
  category: '',
  description: '',
  content: '',
  is_public: true,
})

const isFiniteCoordinate = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value)

export function useTimelineEventEditor({
  events,
  setActiveCompare,
  upsertHydratedEvent,
  removeHydratedEvent,
  removeCompareId,
  fetchEventById,
}: TimelineEventEditorOptions) {
  const store = useTimelineStore()
  const detailEvent = ref<TimelineEvent | null>(null)
  const showForm = ref(false)
  const editingEvent = ref<TimelineEvent | null>(null)
  const deletingEvent = ref<TimelineEvent | null>(null)
  const submitting = ref(false)
  const formError = ref('')
  const form = ref(emptyForm())
  const tagsInput = ref('')

  const getCoordinateValidationError = () => {
    const { latitude, longitude } = form.value
    const hasLatitude = isFiniteCoordinate(latitude)
    const hasLongitude = isFiniteCoordinate(longitude)

    if (hasLatitude !== hasLongitude) {
      return '经纬度需要同时填写，或同时留空。'
    }
    if (hasLatitude && latitude !== null && (latitude < -90 || latitude > 90)) {
      return '纬度必须在 -90 到 90 之间。'
    }
    if (hasLongitude && longitude !== null && (longitude < -180 || longitude > 180)) {
      return '经度必须在 -180 到 180 之间。'
    }
    return ''
  }

  const openDetail = (event: TimelineEvent) => {
    setActiveCompare(event.id)
    detailEvent.value = event
  }

  const refreshDecidedEvent = async () => {
    if (!detailEvent.value) return
    const refreshed = await fetchEventById(detailEvent.value.id)
    if (!refreshed) return
    detailEvent.value = refreshed
    const index = events.value.findIndex(({ id }) => id === refreshed.id)
    if (index >= 0) events.value[index] = refreshed
  }

  const openCreate = () => {
    editingEvent.value = null
    form.value = emptyForm()
    tagsInput.value = ''
    formError.value = ''
    showForm.value = true
  }

  const openEdit = (event: TimelineEvent) => {
    setActiveCompare(event.id)
    editingEvent.value = event
    form.value = {
      title: event.title,
      event_date: event.event_date.slice(0, 16).replace(' ', 'T'),
      end_date: event.end_date ? event.end_date.slice(0, 16).replace(' ', 'T') : '',
      location: event.location || '',
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      source: event.source || '',
      category: event.category || '',
      description: event.description || '',
      content: event.content || '',
      is_public: event.is_public ?? true,
    }
    tagsInput.value = (event.tags || []).join(', ')
    detailEvent.value = null
    formError.value = ''
    showForm.value = true
  }

  const closeForm = () => {
    showForm.value = false
    editingEvent.value = null
    formError.value = ''
  }

  const submitForm = async () => {
    if (!form.value.title || !form.value.event_date || !form.value.location || !form.value.source) return

    const coordinateError = getCoordinateValidationError()
    if (coordinateError) {
      formError.value = coordinateError
      return
    }

    formError.value = ''
    submitting.value = true
    try {
      const tags = tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean)
      const payload = {
        ...form.value,
        latitude: isFiniteCoordinate(form.value.latitude) ? form.value.latitude : null,
        longitude: isFiniteCoordinate(form.value.longitude) ? form.value.longitude : null,
        tags,
      }
      const savedEvent = editingEvent.value
        ? await store.updateEvent(editingEvent.value.id, payload)
        : await store.createEvent(payload)

      if (savedEvent) {
        upsertHydratedEvent(savedEvent)
        if (detailEvent.value?.id === savedEvent.id) detailEvent.value = savedEvent
      }
      closeForm()
    } catch (error) {
      reportError(error)
      formError.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    } finally {
      submitting.value = false
    }
  }

  const confirmDelete = (event: TimelineEvent) => {
    detailEvent.value = null
    deletingEvent.value = event
  }

  const doDelete = async () => {
    if (!deletingEvent.value) return
    const deletingId = deletingEvent.value.id
    await store.deleteEvent(deletingId)
    removeCompareId(deletingId)
    removeHydratedEvent(deletingId)
    if (detailEvent.value?.id === deletingId) detailEvent.value = null
    deletingEvent.value = null
  }

  return {
    detailEvent,
    showForm,
    editingEvent,
    deletingEvent,
    submitting,
    formError,
    form,
    tagsInput,
    openDetail,
    refreshDecidedEvent,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    confirmDelete,
    doDelete,
  }
}
