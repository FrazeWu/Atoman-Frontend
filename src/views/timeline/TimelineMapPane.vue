<template>
  <div class="a-card tl-map-stage-card">
    <div class="tl-map-stage-note">
      <span>点击地图标记即可展开详情，并把事件加入同一对比池。</span>
      <span v-if="compareCount">当前对比池 {{ compareCount }} 条。</span>
    </div>

    <div class="tl-map-canvas">
      <div ref="eventMapEl" class="tl-event-map" />

      <div v-if="mapOverlayMessage" class="tl-map-overlay">
        {{ mapOverlayMessage }}
      </div>

      <div
        ref="eventPopupEl"
        class="tl-map-popup"
        :class="{ visible: mapPopupVisible }"
        @click.stop
      >
        <template v-if="mapPopupEvent">
          <button type="button" class="tl-popup-close" aria-label="关闭地图弹窗" @click.stop="hideMapPopup">✕</button>
          <div class="tl-popup-title">{{ mapPopupEvent.title }}</div>
          <div class="tl-popup-date">{{ formatEventRange(mapPopupEvent) }}</div>
          <div v-if="mapPopupEvent.location" class="tl-popup-location">{{ mapPopupEvent.location }}</div>
          <div v-if="mapPopupEvent.category" class="tl-popup-category">{{ mapPopupEvent.category }}</div>
          <div class="tl-popup-actions">
            <PButton size="sm" @click.stop="emit('toggleCompare', mapPopupEvent)">
              {{ isCompared(mapPopupEvent.id) ? '移出对比' : '加入对比' }}
            </PButton>
            <PButton size="sm" variant="secondary" @click.stop="emit('openDetail', mapPopupEvent)">展开详情</PButton>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import Overlay from 'ol/Overlay'
import type { TimelineEvent } from '@/types'
import PButton from '@/components/ui/PButton.vue'

const props = defineProps<{
  mapRenderableEvents: TimelineEvent[]
  compareCount: number
  compareIds: string[]
  activeCompareId: string | null
  activeCompareEvent: TimelineEvent | null
}>()

const emit = defineEmits<{
  toggleCompare: [event: TimelineEvent]
  openDetail: [event: TimelineEvent]
  focusCompare: [id: string]
}>()

const DAY_MS = 24 * 60 * 60 * 1000

const mapPopupVisible = ref(false)
const mapPopupEvent = ref<TimelineEvent | null>(null)
const eventMapEl = ref<HTMLElement | null>(null)
const eventPopupEl = ref<HTMLElement | null>(null)

const compareSet = computed(() => new Set(props.compareIds))
const eventById = computed(() => new Map(props.mapRenderableEvents.map((event) => [event.id, event] as const)))

let eventMap: OlMap | null = null
let eventVectorSource: VectorSource | null = null
let eventPopupOverlay: Overlay | null = null

const getEventStartMs = (event: TimelineEvent) => new Date(event.event_date).getTime()

const canMapEvent = (event: TimelineEvent | null | undefined): event is TimelineEvent =>
  Boolean(
    event &&
    typeof event.latitude === 'number' &&
    Number.isFinite(event.latitude) &&
    typeof event.longitude === 'number' &&
    Number.isFinite(event.longitude),
  )

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

  if (hours === 0 && minutes === 0) return dateLabel

  return `${dateLabel} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatEventRange = (event: TimelineEvent) => {
  const startLabel = formatDatetime(event.event_date)
  const endDate = event.end_date || event.event_date
  const endMs = new Date(endDate).getTime()

  if (!event.end_date || !Number.isFinite(endMs) || endMs <= getEventStartMs(event)) {
    return startLabel
  }

  return `${startLabel} — ${formatDatetime(endDate)}`
}

const isCompared = (id: string) => compareSet.value.has(id)

const mapOverlayMessage = computed(() => {
  if (!props.mapRenderableEvents.length) {
    return '当前筛选结果与对比池中暂无可定位事件。'
  }

  if (!props.compareCount) {
    return '点击任意地图标记查看事件，并把它加入对比池。'
  }

  if (!mapPopupEvent.value) {
    return '地图会高亮对比池中的事件。点击标记可以继续添加或查看详情。'
  }

  return ''
})

const mapFocusEvent = computed(() => {
  if (canMapEvent(mapPopupEvent.value)) {
    return mapPopupEvent.value
  }

  if (canMapEvent(props.activeCompareEvent)) {
    return props.activeCompareEvent
  }

  return null
})

const buildEventPointStyle = (event: TimelineEvent) => {
  const isActive = mapPopupEvent.value?.id === event.id || props.activeCompareId === event.id
  const inCompare = compareSet.value.has(event.id)

  return new Style({
    image: new CircleStyle({
      radius: isActive ? 10 : inCompare ? 8 : 6,
      fill: new Fill({ color: inCompare || isActive ? 'var(--a-color-fg)' : 'var(--a-color-bg)' }),
      stroke: new Stroke({ color: inCompare || isActive ? 'var(--a-color-bg)' : 'var(--a-color-fg)', width: isActive ? 3 : 2 }),
    }),
  })
}

const hideMapPopup = () => {
  mapPopupVisible.value = false
  mapPopupEvent.value = null
  eventPopupOverlay?.setPosition(undefined)
}

const setMapPopup = (event: TimelineEvent, coordinate?: number[]) => {
  mapPopupEvent.value = event

  if (!coordinate || !eventPopupOverlay) {
    hideMapPopup()
    return
  }

  eventPopupOverlay.setPosition(coordinate)
  mapPopupVisible.value = true
}

const fitMapToEvents = () => {
  if (!eventMap || !eventVectorSource || !props.mapRenderableEvents.length) return

  const extent = eventVectorSource.getExtent()

  if (props.mapRenderableEvents.length === 1) {
    const event = props.mapRenderableEvents[0]
    eventMap.getView().setCenter(fromLonLat([event.longitude!, event.latitude!]))
    eventMap.getView().setZoom(4)
    return
  }

  eventMap.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 7 })
}

const focusMapEventOnMap = (animate = true) => {
  if (!eventMap || !mapFocusEvent.value || !canMapEvent(mapFocusEvent.value)) {
    hideMapPopup()
    if (props.mapRenderableEvents.length) {
      fitMapToEvents()
    }
    return
  }

  const coordinate = fromLonLat([mapFocusEvent.value.longitude!, mapFocusEvent.value.latitude!])

  if (mapPopupEvent.value?.id === mapFocusEvent.value.id) {
    setMapPopup(mapFocusEvent.value, coordinate)
  }

  const view = eventMap.getView()

  if (animate) {
    view.animate({
      center: coordinate,
      zoom: Math.max(view.getZoom() || 3, 4),
      duration: 350,
    })
    return
  }

  view.setCenter(coordinate)
  if ((view.getZoom() || 0) < 4) {
    view.setZoom(4)
  }
}

const renderEventMap = () => {
  if (!eventVectorSource) return

  eventVectorSource.clear()

  for (const event of props.mapRenderableEvents) {
    const feature = new Feature({
      geometry: new Point(fromLonLat([event.longitude!, event.latitude!])),
      eventId: event.id,
    })
    feature.setStyle(buildEventPointStyle(event))
    eventVectorSource.addFeature(feature)
  }

  if (!eventMap) return

  if (mapPopupEvent.value && !eventById.value.has(mapPopupEvent.value.id)) {
    hideMapPopup()
  }

  if (!props.mapRenderableEvents.length) {
    hideMapPopup()
    eventMap.getView().setCenter(fromLonLat([20, 30]))
    eventMap.getView().setZoom(2)
    return
  }

  if (mapFocusEvent.value && canMapEvent(mapFocusEvent.value)) {
    focusMapEventOnMap(false)
    return
  }

  fitMapToEvents()
}

const initEventMap = () => {
  if (!eventMapEl.value || !eventPopupEl.value) return

  if (eventMap) {
    eventMap.setTarget(eventMapEl.value)
    eventPopupOverlay?.setElement(eventPopupEl.value)
    eventMap.updateSize()
    return
  }

  eventVectorSource = new VectorSource()
  const vectorLayer = new VectorLayer({ source: eventVectorSource })

  eventPopupOverlay = new Overlay({
    element: eventPopupEl.value,
    positioning: 'bottom-center',
    stopEvent: true,
    offset: [0, -18],
  })

  eventMap = new OlMap({
    target: eventMapEl.value,
    layers: [new TileLayer({ source: new OSM() }), vectorLayer],
    overlays: [eventPopupOverlay],
    view: new View({
      center: fromLonLat([20, 30]),
      zoom: 2,
    }),
  })

  eventMap.on('click', (evt: any) => {
    const feature = eventMap?.forEachFeatureAtPixel(evt.pixel, (item) => item)
    if (!feature) {
      hideMapPopup()
      return
    }

    const eventId = feature.get('eventId') as string | undefined
    const event = eventById.value.get(eventId || '')

    if (!event) {
      hideMapPopup()
      return
    }

    const coordinate = (feature.getGeometry() as Point).getCoordinates()
    setMapPopup(event, coordinate)
    if (isCompared(event.id)) {
      emit('focusCompare', event.id)
    }
    renderEventMap()
  })

  eventMap.on('pointermove', (evt: any) => {
    const hit = eventMap?.hasFeatureAtPixel(evt.pixel)
    if (eventMap) {
      eventMap.getTargetElement().style.cursor = hit ? 'pointer' : ''
    }
  })

  renderEventMap()
}

watch(
  () => props.compareIds.join(','),
  () => {
    if (!props.compareIds.length) {
      hideMapPopup()
    }
  },
)

watch(
  () => props.mapRenderableEvents.map((event) => `${event.id}:${event.updated_at}`).join('|'),
  () => {
    if (!mapPopupEvent.value) return

    const freshEvent = eventById.value.get(mapPopupEvent.value.id)
    if (freshEvent) {
      mapPopupEvent.value = freshEvent
      return
    }

    hideMapPopup()
  },
  { immediate: true },
)

watch(
  [
    () => props.mapRenderableEvents.map((event) => `${event.id}:${event.updated_at}`).join('|'),
    () => props.compareIds.join(','),
    () => props.activeCompareId,
    () => props.activeCompareEvent?.id,
    () => mapPopupEvent.value?.id,
  ],
  async () => {
    await nextTick()
    initEventMap()
    eventMap?.updateSize()
    renderEventMap()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  eventMap?.setTarget(undefined)
  eventMap = null
  eventVectorSource = null
  eventPopupOverlay = null
})
</script>

<style scoped>
.tl-map-stage-card {
  padding: 1.35rem;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.04), transparent 28%),
    var(--a-color-bg);
  box-shadow: none;
}

.tl-map-stage-note {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  line-height: 1.65;
  color: var(--a-color-muted);
}

.tl-map-canvas {
  position: relative;
  min-height: 36rem;
  border: 1px solid var(--a-color-border-soft);
  overflow: hidden;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.tl-event-map {
  width: 100%;
  height: 36rem;
}

.tl-map-overlay {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  z-index: 10;
  padding: 0.75rem 0.9rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--a-color-border-soft);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.55;
}

.tl-map-popup {
  position: relative;
  min-width: 14rem;
  max-width: 18rem;
  padding: 0.75rem 0.85rem;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.tl-map-popup.visible {
  opacity: 1;
  pointer-events: auto;
}

.tl-popup-close {
  position: absolute;
  top: 0.25rem;
  right: 0.35rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
}

.tl-popup-title {
  margin-bottom: 0.25rem;
  padding-right: 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0;
}

.tl-popup-date,
.tl-popup-location,
.tl-popup-category {
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--a-color-muted);
}

.tl-popup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.85rem;
}

@media (max-width: 768px) {
  .tl-map-stage-card {
    box-shadow: none;
  }

  .tl-map-stage-note {
    flex-direction: column;
    align-items: flex-start;
  }

  .tl-map-canvas,
  .tl-event-map {
    min-height: 24rem;
    height: 24rem;
  }
}
</style>
