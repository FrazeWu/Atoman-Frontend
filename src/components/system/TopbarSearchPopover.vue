<template>
  <Teleport to="body" :disabled="isTest">
    <transition name="topbar-search-backdrop">
      <div
        v-if="open && mode === 'expanded'"
        class="topbar-search-backdrop"
        @click="closeExpanded"
      />
    </transition>

    <transition name="topbar-search-sheet">
      <section
        v-if="open && mode === 'expanded'"
        class="topbar-search-sheet"
        :style="sheetStyle"
      >
        <header class="topbar-search-sheet__header">
          <div>
            <p class="topbar-search-sheet__eyebrow">全站搜索</p>
            <h2 class="topbar-search-sheet__title">“{{ localQuery.trim() }}”</h2>
          </div>
          <button class="topbar-search-sheet__close" type="button" @click="closeExpanded">收起</button>
        </header>

        <div class="topbar-search-sheet__body">
          <p v-if="search.loading.value" class="topbar-search-popover__hint">搜索中...</p>
          <p v-else-if="search.sections.value.length === 0" class="topbar-search-popover__hint">没有找到匹配内容</p>
          <div v-else class="topbar-search-sheet__sections">
            <TopbarSearchSection
              v-for="section in search.sections.value"
              :key="`expanded-${section.type}`"
              :section="section"
              :active-id="search.activeItem.value?.id || ''"
              @open-item="openHref"
              @open-more="openMore"
            />
          </div>
        </div>
      </section>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

type SearchSurfaceMode = 'preview' | 'expanded'
const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const search = useGlobalSearch()
const rootRef = ref<HTMLElement | null>(null)
const localQuery = ref('')
const mode = ref<SearchSurfaceMode>('preview')
const paperMaxHeight = ref(420)
const sheetTop = ref(64)
const sheetRight = ref(16)
let searchTimer: number | null = null
let resizeHandler: (() => void) | null = null
let inputBridgeHandler: ((event: Event) => void) | null = null
let expandBridgeHandler: ((event: Event) => void) | null = null

const paperStyle = computed(() => ({
  maxHeight: `${paperMaxHeight.value}px`,
}))

const sheetStyle = computed(() => ({
  top: `${sheetTop.value}px`,
  right: `${sheetRight.value}px`,
  width: 'min(34rem, calc(36vw + 4rem), calc(100vw - 1.25rem))',
  maxHeight: `${paperMaxHeight.value}px`,
}))

const updatePaperMaxHeight = () => {
  if (typeof window === 'undefined') return
  const rootRect = rootRef.value?.getBoundingClientRect()
  const top = rootRect?.top ?? 56
  const playerTop = document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight - 24
  const safeBottom = Math.max(playerTop - 16, top + 220)
  paperMaxHeight.value = Math.max(safeBottom - top - 120, 240)
  if (rootRect) {
    sheetTop.value = rootRect.bottom + 10
    sheetRight.value = Math.max(window.innerWidth - rootRect.right, 12)
  }
}

const runSearch = (value: string, nextMode: SearchSurfaceMode) => {
  void search.search(value, nextMode)
}

const onInput = (value: string) => {
  localQuery.value = value
  if (searchTimer) clearTimeout(searchTimer)
  mode.value = 'preview'
  searchTimer = window.setTimeout(() => {
    runSearch(value, 'preview')
  }, 180)
}

const openHref = async (href: string) => {
  emit('close')
  await router.push(href)
}

const openMore = async (href: string) => {
  emit('close')
  await router.push(href)
}

const expandPaper = async () => {
  mode.value = 'expanded'
  updatePaperMaxHeight()
  await nextTick()
  if (localQuery.value.trim().length >= 2) {
    runSearch(localQuery.value, 'expanded')
  }
}

const closeExpanded = () => {
  mode.value = 'preview'
}

const handleEnter = async () => {
  if (mode.value === 'preview') {
    await expandPaper()
    return
  }
  if (search.activeItem.value) {
    await openHref(search.activeItem.value.href)
    return
  }
  if (localQuery.value.trim().length >= 2) {
    await openMore(`/forum/search?q=${encodeURIComponent(localQuery.value.trim())}`)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    search.moveActive(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    search.moveActive(-1)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    void handleEnter()
  }
}

watch(() => props.open, (open) => {
  if (!open) {
    localQuery.value = ''
    mode.value = 'preview'
    search.reset()
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    return
  }
  updatePaperMaxHeight()
})

watch(mode, (currentMode) => {
  if (currentMode === 'expanded') {
    updatePaperMaxHeight()
  }
})

onMounted(() => {
  if (props.open) updatePaperMaxHeight()
  resizeHandler = () => updatePaperMaxHeight()
  window.addEventListener('resize', resizeHandler)
  inputBridgeHandler = (event: Event) => {
    const customEvent = event as CustomEvent<string>
    localQuery.value = customEvent.detail || ''
    if (searchTimer) clearTimeout(searchTimer)
    mode.value = 'preview'
    searchTimer = window.setTimeout(() => {
      runSearch(localQuery.value, 'preview')
    }, 180)
  }
  expandBridgeHandler = () => {
    if (!props.open) return
    void expandPaper()
  }
  window.addEventListener('atoman-topbar-search-input', inputBridgeHandler as EventListener)
  window.addEventListener('atoman-topbar-search-expand', expandBridgeHandler as EventListener)
})

onBeforeUnmount(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (inputBridgeHandler) {
    window.removeEventListener('atoman-topbar-search-input', inputBridgeHandler as EventListener)
    inputBridgeHandler = null
  }
  if (expandBridgeHandler) {
    window.removeEventListener('atoman-topbar-search-expand', expandBridgeHandler as EventListener)
    expandBridgeHandler = null
  }
})
</script>

<style scoped>
.topbar-search-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 1800;
  display: grid;
  gap: 0;
  transition:
    width 0.22s cubic-bezier(0.2, 0, 0, 1),
    transform 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.topbar-search-preview {
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.75rem 0.9rem 0.85rem;
  display: grid;
  gap: 0.75rem;
  transform-origin: top right;
  transition:
    transform 0.24s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.24s cubic-bezier(0.2, 0, 0, 1),
    border-color 0.24s ease,
    background-color 0.24s ease,
    padding 0.24s ease;
}

.topbar-search-popover.is-preview .topbar-search-preview {
  transform: translateY(0) scale(1);
}

.topbar-search-popover.is-expanded .topbar-search-preview {
  box-shadow: 0 2px 6px rgba(18, 18, 18, 0.02);
  border-bottom-color: transparent;
  background: color-mix(in srgb, var(--a-color-paper) 96%, #f5f0e8 4%);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  padding-bottom: 0.55rem;
}

.topbar-search-preview__sections,
.topbar-search-sheet__sections {
  display: grid;
  gap: 1rem;
}

.topbar-search-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.03);
  z-index: 2798;
}

.topbar-search-sheet {
  position: fixed;
  z-index: 2799;
  background:
    linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(250, 247, 241, 0.99)),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 24px,
      rgba(120, 110, 90, 0.03) 24px,
      rgba(120, 110, 90, 0.03) 25px
    );
  border: 1px solid var(--a-color-line-soft);
  box-shadow: 0 24px 60px rgba(18, 18, 18, 0.14);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 0 0 12px 12px;
  will-change: transform, opacity;
}

.topbar-search-sheet__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1.1rem 0.9rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  animation: paperFadeIn 0.18s ease-out 0.08s both;
}

.topbar-search-sheet__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: var(--a-color-muted-soft);
}

.topbar-search-sheet__title {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 900;
  color: var(--a-color-fg);
}

.topbar-search-sheet__close {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 800;
}

.topbar-search-sheet__body {
  overflow: auto;
  padding: 0.95rem 1.1rem 1.1rem;
  animation: paperFadeIn 0.22s ease-out 0.14s both;
}

.topbar-search-popover__hint {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.topbar-search-backdrop-enter-active,
.topbar-search-backdrop-leave-active {
  transition: opacity 0.22s ease;
}

.topbar-search-backdrop-enter-from,
.topbar-search-backdrop-leave-to {
  opacity: 0;
}

.topbar-search-sheet-enter-active,
.topbar-search-sheet-leave-active {
  transition:
    opacity 0.26s cubic-bezier(0.2, 0, 0, 1),
    transform 0.28s cubic-bezier(0.2, 0, 0, 1);
  transform-origin: top right;
}

.topbar-search-sheet-enter-from,
.topbar-search-sheet-leave-to {
  opacity: 0;
  transform: translateY(-4px) translateX(4px) scale(0.985);
}

@keyframes paperFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .topbar-search-popover {
    right: -0.5rem;
  }

  .topbar-search-sheet__header,
  .topbar-search-sheet__body {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
