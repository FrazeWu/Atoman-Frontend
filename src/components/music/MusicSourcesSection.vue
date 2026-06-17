<template>
  <PSurface class="music-sources" tone="soft" :layer="0">
    <div class="music-sources__header">
      <div>
        <h3 class="music-sources__title">来源</h3>
        <p class="music-sources__hint">为每条变更保留可核查链接。</p>
      </div>
      <PButton type="button" kind="ghost" @click="addSource">添加来源</PButton>
    </div>

    <div v-if="sources.length" class="music-sources__list">
      <div v-for="source in sources" :key="source.id" class="music-sources__item">
        <PInput :model-value="source.title" label="来源标题" placeholder="来源标题" @update:model-value="(value) => updateSource(source.id, 'title', value)" />
        <PInput :model-value="source.url" label="来源链接" placeholder="https://..." @update:model-value="(value) => updateSource(source.id, 'url', value)" />
        <PButton type="button" variant="ghost" @click="removeSource(source.id)">移除</PButton>
      </div>
    </div>

    <PEmpty v-else description="尚未添加来源" />
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSurface from '@/components/ui/PSurface.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import type { MusicSourceDraft } from './types'

const props = defineProps<{
  sources: MusicSourceDraft[]
}>()

const emit = defineEmits<{
  (e: 'update:sources', value: MusicSourceDraft[]): void
}>()

const sources = computed({
  get: () => props.sources,
  set: (value) => emit('update:sources', value),
})

function addSource() {
  sources.value = [...sources.value, { id: crypto.randomUUID(), title: '', url: '' }]
}

function updateSource(id: string, field: 'title' | 'url', value: string) {
  sources.value = sources.value.map((source) =>
    source.id === id ? { ...source, [field]: value } : source,
  )
}

function removeSource(id: string) {
  sources.value = sources.value.filter((source) => source.id !== id)
}
</script>

<style scoped>
.music-sources {
  padding: 1rem;
}

.music-sources__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.music-sources__title {
  margin: 0;
  font-size: 1rem;
}

.music-sources__hint {
  margin: 0.25rem 0 0;
  color: var(--a-color-text-muted);
  font-size: 0.875rem;
}

.music-sources__list {
  display: grid;
  gap: 0.75rem;
}

.music-sources__item {
  display: grid;
  grid-template-columns: 1fr 1.5fr auto;
  gap: 0.5rem;
  align-items: start;
}

@media (max-width: 720px) {
  .music-sources__item {
    grid-template-columns: 1fr;
  }
}
</style>
