<script setup lang="ts">
import { computed, ref } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import type { MusicSheetLayer } from './musicSheetTypes'
import {
  listMusicAlbums,
  listMusicArtists,
  submitMusicEdit,
} from '@/api/musicV1'

type MergeTarget = { id: string; label: string; meta: string }
type ActionLayer = Extract<MusicSheetLayer, { kind: 'action' }>

const props = withDefaults(defineProps<{ layer?: ActionLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })

const {
  state,
  closeNestedAction,
  isLayerShifted,
  isTopLayer,
} = useMusicDrawers()

const action = computed(() => props.layer?.payload.action ?? state.value.nestedAction)
const payload = computed(() => {
  const value = props.layer?.payload.data ?? state.value.nestedPayload
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
})
const entity = computed(() => action.value === 'merge_album' ? 'album' : 'artist')
const isOpen = computed(() => action.value === 'merge_artist' || action.value === 'merge_album')
const sourceId = computed(() => {
  const explicitId = entity.value === 'artist' ? payload.value.artistId : payload.value.albumId
  return String(explicitId ?? (entity.value === 'artist' ? state.value.artistId : state.value.albumId) ?? '') || null
})
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentAction = () => closeNestedAction(props.layer?.key)
const query = ref('')
const targets = ref<MergeTarget[]>([])
const selected = ref<MergeTarget | null>(null)
const confirming = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function search() {
  errorMessage.value = ''
  loading.value = true
  try {
    if (entity.value === 'artist') {
      const response = await listMusicArtists({ q: query.value, page: 1, page_size: 20 })
      targets.value = response.data
        .filter(item => item.id !== sourceId.value && item.entry_status !== 'closed')
        .map(item => ({ id: item.id, label: item.name, meta: item.legal_name || '艺术家' }))
    } else {
      const response = await listMusicAlbums({ q: query.value, page: 1, page_size: 20 })
      targets.value = response.data
        .filter(item => item.id !== sourceId.value && item.entry_status !== 'closed')
        .map(item => ({
          id: item.id,
          label: item.title,
          meta: item.artists?.map(artist => artist.name).join(' / ') || '专辑',
        }))
    }
  } catch {
    errorMessage.value = '搜索失败，请重试'
  } finally {
    loading.value = false
  }
}

async function merge() {
  if (!selected.value || !sourceId.value || loading.value) return
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true
  try {
    const entityType = entity.value
    await submitMusicEdit({
      type: entityType === 'artist' ? 'merge_artist' : 'merge_album',
      entity_type: entityType,
      entity_id: sourceId.value,
      changes: { target_id: selected.value.id },
      reason: entityType === 'artist' ? '合并重复艺术家' : '合并重复专辑',
    })
    successMessage.value = '已提交审核'
    window.setTimeout(closeCurrentAction, 1200)
  } catch {
    errorMessage.value = '提交失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PSheet
    :show="isOpen"
    title="合并重复条目"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    @close="closeCurrentAction"
  >
    <div class="merge-drawer">
      <p v-if="errorMessage" class="merge-error">{{ errorMessage }}</p>
      <p v-if="successMessage" role="status">{{ successMessage }}</p>

      <template v-if="!successMessage && !confirming">
        <div class="merge-search">
          <input
            v-model="query"
            data-test="merge-search-input"
            type="search"
            :placeholder="entity === 'artist' ? '搜索目标艺术家' : '搜索目标专辑'"
            @keyup.enter="search"
          />
          <button data-test="merge-search-button" type="button" :disabled="loading" @click="search">搜索</button>
        </div>

        <button
          v-for="target in targets"
          :key="target.id"
          type="button"
          class="merge-target"
          :class="{ 'is-selected': selected?.id === target.id }"
          :data-test="`merge-target-${target.id}`"
          @click="selected = target"
        >
          <strong>{{ target.label }}</strong>
          <span>{{ target.meta }}</span>
        </button>

        <button data-test="merge-continue" type="button" :disabled="!selected" @click="confirming = true">继续</button>
      </template>

      <template v-else-if="!successMessage">
        <p>审核通过后，当前条目将并入目标条目</p>
        <strong>{{ selected?.label }}</strong>
        <div class="merge-confirm-actions">
          <button type="button" :disabled="loading" @click="confirming = false">返回</button>
          <button data-test="merge-confirm" type="button" :disabled="loading" @click="merge">提交审核</button>
        </div>
      </template>
    </div>
  </PSheet>
</template>

<style scoped>
.merge-drawer { display: grid; gap: 12px; padding: 20px; }
.merge-search { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.merge-search input { min-width: 0; padding: 10px 12px; border: 1px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-ink); }
.merge-drawer button { padding: 9px 12px; border: 1px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-ink); cursor: pointer; }
.merge-drawer button:disabled { cursor: default; opacity: 0.5; }
.merge-target { display: grid; gap: 3px; text-align: left; }
.merge-target span { color: var(--a-color-ink-soft); font-size: 0.82rem; }
.merge-target.is-selected { border-color: var(--a-color-ink); }
.merge-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
.merge-error { color: var(--a-color-danger); }
</style>
