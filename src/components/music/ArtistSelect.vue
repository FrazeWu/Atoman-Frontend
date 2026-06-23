<template>
  <div class="artist-select" ref="wrapRef">
    <!-- Selected tags -->
    <div v-if="selected.length" class="tags">
      <span v-for="a in selected" :key="a.id" class="tag">
        {{ a.name }}
        <button class="tag-remove" type="button" :disabled="disabled" @click="remove(a.id)">✕</button>
      </span>
    </div>

    <!-- Input -->
    <div class="input-wrap">
      <PInput
        v-model="query"
        :placeholder="placeholder || '搜索艺术家'"
        :label="label"
        :disabled="disabled"
        @focus="open = true"
        @keydown.esc="open = false"
      />
    </div>

    <!-- Dropdown -->
    <div v-if="open" class="dropdown">
      <!-- Filtered results -->
      <div
        v-for="a in filtered"
        :key="a.id"
        class="dropdown-item"
        @mousedown.prevent="select(a)"
      >
        {{ a.name }}
      </div>

      <div class="dropdown-section">
        <div class="dropdown-divider" />
        <RouterLink :to="`/artist/new${query.trim() ? `?name=${encodeURIComponent(query.trim())}` : ''}`" class="add-artist-link" @mousedown.prevent>
          没找到艺术家？前往新增页面
        </RouterLink>
      </div>

      <div v-if="!filtered.length && !query.trim()" class="dropdown-empty">输入关键字搜索</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import PInput from '@/components/ui/PInput.vue'
import { listMusicArtists, type MusicArtistListItem } from '@/api/musicV1'
import type { Artist } from '@/types'

const props = defineProps<{
  modelValue: Artist[]
  label?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: Artist[]): void
}>()

const wrapRef = ref<HTMLElement | null>(null)
const query = ref('')
const open = ref(false)
const allArtists = ref<Artist[]>([])

const selected = computed(() => props.modelValue)

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  const selectedIds = new Set(selected.value.map(a => a.id))
  return allArtists.value
    .filter(a => !selectedIds.has(a.id) && a.name.toLowerCase().includes(q))
    .slice(0, 8)
})

const select = (a: Artist) => {
  if (props.disabled) return
  emit('update:modelValue', [...selected.value, a])
  query.value = ''
}

const remove = (id: number) => {
  if (props.disabled) return
  emit('update:modelValue', selected.value.filter(a => a.id !== id))
}

const dedupeArtistsByName = (artists: Artist[]) => {
  const seen = new Set<string>()
  return artists.filter((artist) => {
    const key = artist.name.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const toArtistOption = (artist: MusicArtistListItem): Artist => ({
  id: Number.parseInt(artist.id, 10),
  name: artist.name,
  bio: artist.bio,
  image_url: artist.image_url,
  nationality: artist.nationality,
  birth_year: artist.birth_year,
  death_year: artist.death_year,
  members: artist.members,
  entry_status: artist.entry_status === 'closed' || artist.entry_status === 'protected'
    ? 'disputed'
    : artist.entry_status,
  created_at: artist.created_at,
  updated_at: artist.updated_at,
})

const fetchArtists = async () => {
  try {
    const result = await listMusicArtists({ page: 1, page_size: 100 })
    allArtists.value = dedupeArtistsByName(
      result.data
        .map(toArtistOption)
        .filter((artist) => Number.isFinite(artist.id)),
    )
  } catch (e) { console.error(e) }
}

const clickOutside = (e: MouseEvent) => {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  fetchArtists()
  document.addEventListener('click', clickOutside)
})
onUnmounted(() => document.removeEventListener('click', clickOutside))
watch(query, (v) => { if (v) open.value = true })
</script>

<style scoped>
.artist-select { position: relative; }
.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  margin-bottom: 0.5rem;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.tag {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: #000;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
}
.tag-remove {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0;
  line-height: 1;
}
.input-wrap { position: relative; }
.field-input {
  width: 100%;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  border: 1px solid var(--a-color-line);
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}
.field-input:focus { border-color: var(--a-color-fg); }
.dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line);
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
}
.dropdown-item {
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.1s;
}
.dropdown-item:hover { background: var(--a-color-paper-wash); }
.dropdown-empty { padding: 1rem; color: var(--a-color-muted); font-size: 0.875rem; text-align: center; }
.dropdown-section { padding: 0.5rem; }
.dropdown-divider { height: 1px; background: var(--a-color-line-soft); margin: 0.25rem 0; }
.add-artist-link {
  display: inline-block;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  text-decoration: none;
  border: 1px solid var(--a-color-ink);
  padding: 0.45rem 0.75rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: all 0.15s ease;
}
.add-artist-link:hover { background: var(--a-color-paper); color: var(--a-color-ink); }
</style>
