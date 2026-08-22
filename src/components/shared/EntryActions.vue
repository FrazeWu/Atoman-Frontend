<template>
  <div class="entry-actions" @click.stop>
    <!-- 1. 收藏按钮 -->
    <PClip
      :active="bookmarked"
      :disabled="disabled"
      :title="bookmarked ? '取消收藏' : '收藏'"
      class="entry-action-btn"
      :class="{ 'is-pop': animatingKey === 'bookmark' }"
      @click="handleAction('bookmark', $event)"
    >
      <Bookmark
        :size="iconSize"
        class="entry-action-icon"
        :class="{ 'is-active': bookmarked }"
        :fill="bookmarked ? 'currentColor' : 'none'"
      />
      <span v-if="showLabels" class="entry-action-label">
        {{ bookmarked ? '已收藏' : '收藏' }}
      </span>
    </PClip>

    <!-- 2. 稍后阅读按钮 -->
    <PClip
      :active="inReadingList"
      :disabled="disabled"
      :title="inReadingList ? '取消稍后阅读' : '稍后阅读'"
      class="entry-action-btn"
      :class="{ 'is-pop': animatingKey === 'readingList' }"
      @click="handleAction('readingList', $event)"
    >
      <Clock
        :size="iconSize"
        class="entry-action-icon"
        :class="{ 'is-active': inReadingList }"
      />
      <span v-if="showLabels" class="entry-action-label">
        {{ inReadingList ? '已稍后读' : '稍后阅读' }}
      </span>
    </PClip>

    <!-- 3. 星标推荐按钮 -->
    <PClip
      v-if="showStar"
      :active="starred"
      :disabled="disabled"
      :title="starred ? '取消星标' : '星标推荐'"
      class="entry-action-btn"
      :class="{ 'is-pop': animatingKey === 'star' }"
      @click="handleAction('star', $event)"
    >
      <Star
        :size="iconSize"
        class="entry-action-icon"
        :class="{ 'is-active': starred }"
        :fill="starred ? 'currentColor' : 'none'"
      />
      <span v-if="showLabels" class="entry-action-label">
        {{ starred ? '已星标' : '星标' }}
      </span>
    </PClip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bookmark, Clock, Star } from 'lucide-vue-next'
import PClip from '@/components/ui/PClip.vue'

const props = withDefaults(defineProps<{
  bookmarked?: boolean
  inReadingList?: boolean
  starred?: boolean
  showLabels?: boolean
  showStar?: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
}>(), {
  bookmarked: false,
  inReadingList: false,
  starred: false,
  showLabels: true,
  showStar: true,
  size: 'sm',
  disabled: false,
})

const emit = defineEmits<{
  'toggle-bookmark': [event: MouseEvent]
  'toggle-reading-list': [event: MouseEvent]
  'toggle-star': [event: MouseEvent]
}>()

const animatingKey = ref<string | null>(null)

const iconSize = computed(() => (props.size === 'md' ? 16 : 13))

function handleAction(key: 'bookmark' | 'readingList' | 'star', event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  if (props.disabled) return

  animatingKey.value = key
  setTimeout(() => {
    animatingKey.value = null
  }, 250)

  if (key === 'bookmark') emit('toggle-bookmark', event)
  if (key === 'readingList') emit('toggle-reading-list', event)
  if (key === 'star') emit('toggle-star', event)
}
</script>

<style scoped>
.entry-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.entry-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.15s ease, color 0.15s ease;
}

.entry-action-btn.is-pop {
  animation: actionPop 0.25s ease;
}

.entry-action-label {
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}

@keyframes actionPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
</style>
