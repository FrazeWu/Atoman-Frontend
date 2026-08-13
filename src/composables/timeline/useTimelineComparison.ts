import { computed, ref, watch, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import type { TimelineEvent } from '@/types'
import { reportError } from '@/utils/logger'

type TimelineViewMode = 'lanes' | 'map'

interface TimelineComparisonOptions {
  sortedEvents: ComputedRef<TimelineEvent[]>
}

const DAY_MS = 24 * 60 * 60 * 1000
const uniqueIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)))
const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const normalizeSingleQueryValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

const parseCompareQuery = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  if (Array.isArray(value)) return value.flatMap((item) => parseCompareQuery(item))
  return []
}

const parseModeQuery = (value: unknown): TimelineViewMode =>
  normalizeSingleQueryValue(value) === 'map' ? 'map' : 'lanes'

const getEventStartMs = (event: TimelineEvent) => new Date(event.event_date).getTime()
const getEventEndMs = (event: TimelineEvent) => {
  if (!event.end_date) return getEventStartMs(event)
  const endMs = new Date(event.end_date).getTime()
  return Number.isFinite(endMs) ? endMs : getEventStartMs(event)
}

export function useTimelineComparison({ sortedEvents }: TimelineComparisonOptions) {
  const api = useApi()
  const route = useRoute()
  const router = useRouter()

  const viewMode = ref<TimelineViewMode>('lanes')
  const compareIds = ref<string[]>([])
  const activeCompareId = ref<string | null>(null)
  const batchSelectedIds = ref<string[]>([])
  const hydratedCompareEvents = ref<TimelineEvent[]>([])
  const hydratingCompare = ref(false)
  const routeSyncing = ref(false)

  const knownEvents = computed(() => {
    const eventsById = new Map<string, TimelineEvent>()
    for (const event of hydratedCompareEvents.value) eventsById.set(event.id, event)
    for (const event of sortedEvents.value) eventsById.set(event.id, event)
    return eventsById
  })

  const compareEvents = computed(() =>
    compareIds.value
      .map((id) => knownEvents.value.get(id))
      .filter((event): event is TimelineEvent => Boolean(event)),
  )
  const activeCompareEvent = computed(() =>
    compareEvents.value.find((event) => event.id === activeCompareId.value) ?? compareEvents.value[0] ?? null,
  )
  const compareSet = computed(() => new Set(compareIds.value))

  const isInstantEvent = (event: TimelineEvent) => getEventEndMs(event) <= getEventStartMs(event)
  const canMapEvent = (event: TimelineEvent) =>
    typeof event.latitude === 'number'
    && Number.isFinite(event.latitude)
    && typeof event.longitude === 'number'
    && Number.isFinite(event.longitude)

  const mapRenderableEvents = computed(() => {
    const eventsById = new Map<string, TimelineEvent>()
    for (const event of sortedEvents.value) {
      if (canMapEvent(event)) eventsById.set(event.id, event)
    }
    for (const event of compareEvents.value) {
      if (canMapEvent(event)) eventsById.set(event.id, event)
    }
    return Array.from(eventsById.values()).sort((a, b) => getEventStartMs(a) - getEventStartMs(b))
  })

  const compareBounds = computed(() => {
    if (!compareEvents.value.length) return null

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const event of compareEvents.value) {
      min = Math.min(min, getEventStartMs(event))
      max = Math.max(max, getEventEndMs(event))
    }

    const safeMax = max === min ? max + DAY_MS : max
    return { min, max: safeMax, span: safeMax - min }
  })

  const formatDatetime = (value: string) => {
    if (!value) return ''
    if (value.startsWith('-')) {
      const parts = value.slice(1).split('-')
      const year = parts[0]
      const suffix = parts.length > 1 ? `-${parts.slice(1).join('-')}` : ''
      return `公元前 ${parseInt(year, 10)} 年${suffix ? suffix.slice(0, 6).replace('-', ' ').replace('-', ' 月') + ' 日' : ''}`
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value.slice(0, 16)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const dateLabel = value.slice(0, 10)
    return hours === 0 && minutes === 0
      ? dateLabel
      : `${dateLabel} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const formatTickLabel = (timestamp: number) => {
    const bounds = compareBounds.value
    if (!bounds) return ''

    const totalDays = bounds.span / DAY_MS
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    if (year <= 0) return `BCE ${Math.abs(year)}`
    if (totalDays > 365 * 2) return `${year}`
    if (totalDays > 60) return `${year}-${month}`
    return `${year}-${month}-${day}`
  }

  const formatEventRange = (event: TimelineEvent) =>
    isInstantEvent(event)
      ? formatDatetime(event.event_date)
      : `${formatDatetime(event.event_date)} — ${formatDatetime(event.end_date || event.event_date)}`

  const getDurationLabel = (event: TimelineEvent) => {
    if (isInstantEvent(event)) return '单点事件'

    const diffMs = Math.max(getEventEndMs(event) - getEventStartMs(event), 0)
    const totalMinutes = diffMs / (60 * 1000)
    const totalHours = diffMs / (60 * 60 * 1000)
    const totalDays = diffMs / DAY_MS
    if (totalMinutes < 60) return `${Math.max(Math.round(totalMinutes), 1)} 分钟`
    if (totalHours < 24) return `${Math.max(Math.round(totalHours), 1)} 小时`
    if (totalDays < 60) return `${Math.max(Math.round(totalDays), 1)} 天`

    const totalMonths = totalDays / 30
    if (totalMonths < 24) return `${totalMonths < 6 ? totalMonths.toFixed(1) : Math.round(totalMonths)} 个月`
    const totalYears = totalDays / 365
    return `${totalYears < 10 ? totalYears.toFixed(1) : Math.round(totalYears)} 年`
  }

  const laneTicks = computed(() => {
    const bounds = compareBounds.value
    if (!bounds) return []
    const tickCount = Math.min(Math.max(compareEvents.value.length + 1, 4), 6)
    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0 : index / (tickCount - 1)
      const timestamp = bounds.min + bounds.span * ratio
      return { pct: ratio * 100, label: formatTickLabel(timestamp) }
    })
  })

  const getLaneStyle = (event: TimelineEvent) => {
    const bounds = compareBounds.value
    if (!bounds) return {}

    const startRatio = (getEventStartMs(event) - bounds.min) / bounds.span
    const left = Math.max(0, Math.min(100, startRatio * 100))
    if (isInstantEvent(event)) return { left: `${left}%` }

    const endRatio = (getEventEndMs(event) - bounds.min) / bounds.span
    return {
      left: `${left}%`,
      width: `${Math.max((endRatio - startRatio) * 100, 1.75)}%`,
    }
  }

  const isCompared = (id: string) => compareSet.value.has(id)
  const isBatchSelected = (id: string) => batchSelectedIds.value.includes(id)
  const toggleBatchSelection = (id: string) => {
    batchSelectedIds.value = isBatchSelected(id)
      ? batchSelectedIds.value.filter((value) => value !== id)
      : [...batchSelectedIds.value, id]
  }
  const clearBatchSelection = () => { batchSelectedIds.value = [] }
  const setActiveCompare = (id: string) => {
    if (compareSet.value.has(id)) activeCompareId.value = id
  }

  const upsertHydratedEvent = (event: TimelineEvent) => {
    hydratedCompareEvents.value = [
      ...hydratedCompareEvents.value.filter((item) => item.id !== event.id),
      event,
    ]
  }
  const removeHydratedEvent = (id: string) => {
    hydratedCompareEvents.value = hydratedCompareEvents.value.filter((item) => item.id !== id)
  }
  const addCompareEvent = (event: TimelineEvent) => {
    upsertHydratedEvent(event)
    compareIds.value = uniqueIds([...compareIds.value, event.id])
    activeCompareId.value = event.id
  }
  const removeCompareId = (id: string) => {
    compareIds.value = compareIds.value.filter((value) => value !== id)
    if (activeCompareId.value === id) {
      activeCompareId.value = compareIds.value[compareIds.value.length - 1] ?? null
    }
  }
  const toggleCompareEvent = (event: TimelineEvent) => {
    if (isCompared(event.id)) removeCompareId(event.id)
    else addCompareEvent(event)
  }
  const addBatchToCompare = () => {
    const additions = sortedEvents.value
      .filter((event) => batchSelectedIds.value.includes(event.id))
      .map((event) => event.id)
    if (!additions.length) return
    compareIds.value = uniqueIds([...compareIds.value, ...additions])
    activeCompareId.value = additions[additions.length - 1]
  }
  const clearComparePool = () => {
    compareIds.value = []
    activeCompareId.value = null
  }

  const fetchEventById = async (id: string) => {
    try {
      const response = await apiRequestResult(`${api.url}/timeline/events/${id}`)
      if (!response.ok) return null
      return response.data.data as TimelineEvent
    } catch (error) {
      reportError(error)
      return null
    }
  }

  const hydrateComparePool = async (ids: string[]) => {
    const missingIds = uniqueIds(ids.filter((id) => !knownEvents.value.has(id)))
    if (!missingIds.length) return

    hydratingCompare.value = true
    try {
      const fetchedEvents = await Promise.all(missingIds.map((id) => fetchEventById(id)))
      const resolvedEvents = fetchedEvents.filter((event): event is TimelineEvent => Boolean(event))
      const resolvedIds = new Set(resolvedEvents.map((event) => event.id))
      for (const event of resolvedEvents) upsertHydratedEvent(event)

      const invalidIds = missingIds.filter((id) => !resolvedIds.has(id))
      if (invalidIds.length) {
        compareIds.value = compareIds.value.filter((id) => !invalidIds.includes(id))
      }
    } finally {
      hydratingCompare.value = false
    }
  }

  watch(
    [() => route.query.mode, () => route.query.compare],
    () => {
      if (routeSyncing.value) return
      const nextMode = parseModeQuery(route.query.mode)
      const nextCompareIds = uniqueIds(parseCompareQuery(route.query.compare))
      if (viewMode.value !== nextMode) viewMode.value = nextMode
      if (!sameIds(compareIds.value, nextCompareIds)) compareIds.value = nextCompareIds
    },
    { immediate: true },
  )

  watch([viewMode, () => compareIds.value.join(',')], async () => {
    const currentMode = parseModeQuery(route.query.mode)
    const currentCompare = uniqueIds(parseCompareQuery(route.query.compare))
    if (currentMode === viewMode.value && sameIds(currentCompare, compareIds.value)) return

    routeSyncing.value = true
    try {
      await router.replace({
        query: {
          ...route.query,
          mode: viewMode.value === 'lanes' ? undefined : viewMode.value,
          compare: compareIds.value.length ? compareIds.value.join(',') : undefined,
        },
      })
    } finally {
      routeSyncing.value = false
    }
  })

  watch(
    () => compareIds.value.join(','),
    () => {
      const ids = compareIds.value
      if (!ids.length) {
        activeCompareId.value = null
        return
      }
      if (!activeCompareId.value || !ids.includes(activeCompareId.value)) {
        activeCompareId.value = ids[ids.length - 1]
      }
      void hydrateComparePool(ids)
    },
    { immediate: true },
  )

  watch(
    sortedEvents,
    (nextEvents) => {
      const availableIds = new Set(nextEvents.map((event) => event.id))
      batchSelectedIds.value = batchSelectedIds.value.filter((id) => availableIds.has(id))
    },
    { immediate: true },
  )

  return {
    viewMode,
    compareIds,
    activeCompareId,
    batchSelectedIds,
    hydratingCompare,
    compareEvents,
    activeCompareEvent,
    mapRenderableEvents,
    laneTicks,
    formatDatetime,
    formatEventRange,
    getDurationLabel,
    getLaneStyle,
    isInstantEvent,
    canMapEvent,
    isCompared,
    isBatchSelected,
    toggleBatchSelection,
    clearBatchSelection,
    setActiveCompare,
    upsertHydratedEvent,
    removeHydratedEvent,
    removeCompareId,
    toggleCompareEvent,
    addBatchToCompare,
    clearComparePool,
    fetchEventById,
  }
}
