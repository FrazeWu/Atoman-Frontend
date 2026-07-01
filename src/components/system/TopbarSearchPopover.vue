<template>
  <div
    v-if="open"
    class="topbar-search-popover"
    role="dialog"
    aria-label="全站搜索"
    @click.stop
  >
    <div class="topbar-search-popover__panel">
      <PInput
        ref="inputRef"
        :model-value="localQuery"
        data-testid="topbar-search-input"
        placeholder="搜索论坛、文章、音乐..."
        @update:model-value="onInput"
        @keydown="handleKeydown"
      />

      <p v-if="localQuery.trim().length < 2" class="topbar-search-popover__hint">输入至少 2 个字开始搜索</p>
      <p v-else-if="search.loading.value" class="topbar-search-popover__hint">搜索中...</p>
      <p v-else-if="search.sections.value.length === 0" class="topbar-search-popover__hint">没有找到匹配内容</p>

      <div v-else class="topbar-search-popover__sections">
        <TopbarSearchSection
          v-for="section in search.sections.value"
          :key="section.type"
          :section="section"
          :active-id="search.activeItem.value?.id || ''"
          @open-item="openHref"
          @open-more="openMore"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PInput from '@/components/ui/PInput.vue'
import TopbarSearchSection from '@/components/system/TopbarSearchSection.vue'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const search = useGlobalSearch()
const inputRef = ref<InstanceType<typeof PInput> | null>(null)
const localQuery = ref('')
let searchTimer: number | null = null

const focusInput = async () => {
  await nextTick()
  const input = (inputRef.value?.$el as HTMLElement | undefined)?.querySelector('input') as HTMLInputElement | null
  input?.focus()
}

const onInput = (value: string) => {
  localQuery.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    void search.search(value)
  }, 250)
}

const openHref = async (href: string) => {
  emit('close')
  await router.push(href)
}

const openMore = async (href: string) => {
  emit('close')
  await router.push(href)
}

const handleEnter = async () => {
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
    search.reset()
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    return
  }
  void focusInput()
})

onMounted(() => {
  if (props.open) {
    void focusInput()
  }
})
</script>

<style scoped>
.topbar-search-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(36rem, calc(100vw - 2rem));
  z-index: 60;
}

.topbar-search-popover__panel {
  border: var(--a-border);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-dropdown);
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
}

.topbar-search-popover__hint {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.topbar-search-popover__sections {
  display: grid;
  gap: 1rem;
}
</style>
