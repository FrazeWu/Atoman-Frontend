<template>
  <section class="topbar-search-section">
    <header class="topbar-search-section__header">
      <div class="topbar-search-section__badge">
        <component :is="sectionIcon" :size="13" class="section-icon" aria-hidden="true" />
        <h3>{{ section.label }}</h3>
      </div>
      <span class="section-count">{{ section.items.length }}</span>
    </header>

    <div class="topbar-search-section__list">
      <button
        v-for="item in section.items"
        :key="item.id"
        type="button"
        class="topbar-search-section__item"
        :class="{ 'is-active': activeId === item.id }"
        @click="$emit('openItem', item.href)"
      >
        <div class="item-left">
          <component :is="itemIcon(item.targetType)" :size="15" class="item-type-icon" aria-hidden="true" />
          <div class="item-texts">
            <div class="item-title-row">
              <span class="topbar-search-section__title">{{ item.title }}</span>
              <span v-if="item.meta" class="item-target-tag">{{ item.meta }}</span>
            </div>
            <span v-if="item.subtitle" class="topbar-search-section__subtitle">{{ item.subtitle }}</span>
          </div>
        </div>
        <span class="item-enter-hint" aria-hidden="true">↵</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconFileText as FileText, IconBook2 as BookOpen, IconRss as Rss, IconMusic as Music, IconDisc as Disc, IconMicrophone as Mic, IconVideo as Video, IconUser as User, IconMessage as MessageSquare, IconSparkles as Sparkles, IconLayersLinked as Layers, IconFlame as Flame, IconCalendar as Calendar, type Icon as LucideIcon } from '@tabler/icons-vue'
import type { GlobalSearchSection, GlobalSearchSectionType } from '@/composables/useGlobalSearch'
import type { ReferenceTargetType } from '@/api/references'

const props = defineProps<{
  section: GlobalSearchSection
  activeId: string
}>()

defineEmits<{
  openItem: [href: string]
}>()

const sectionIcons: Record<GlobalSearchSectionType, LucideIcon> = {
  user: User,
  blog: FileText,
  forum: MessageSquare,
  debate: Flame,
  feed: Rss,
  music: Music,
  books: BookOpen,
  podcast: Mic,
  video: Video,
  timeline: Calendar,
}

const sectionIcon = computed(() => sectionIcons[props.section.type] || Sparkles)

function itemIcon(targetType: ReferenceTargetType): LucideIcon {
  switch (targetType) {
    case 'post':
    case 'article':
      return FileText
    case 'short_note':
      return Sparkles
    case 'feed':
      return Rss
    case 'song':
      return Music
    case 'album':
      return Disc
    case 'artist':
      return User
    case 'channel':
    case 'collection':
      return Layers
    case 'video':
      return Video
    case 'podcast':
    case 'episode':
      return Mic
    case 'user':
      return User
    default:
      return FileText
  }
}
</script>

<style scoped>
.topbar-search-section {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.topbar-search-section:last-child {
  margin-bottom: 0;
}

.topbar-search-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.5rem 0.2rem;
}

.topbar-search-section__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--a-color-muted);
}

.section-icon {
  opacity: 0.8;
}

.topbar-search-section__header h3 {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.section-count {
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
  font-weight: 600;
}

.topbar-search-section__list {
  display: grid;
  gap: 0.25rem;
}

.topbar-search-section__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
  width: 100%;
}

.topbar-search-section__item:hover,
.topbar-search-section__item.is-active {
  background: var(--a-color-surface-muted);
  border-color: var(--a-color-border-soft);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  flex: 1;
}

.item-type-icon {
  color: var(--a-color-muted);
  flex-shrink: 0;
  transition: color 0.12s ease;
}

.topbar-search-section__item:hover .item-type-icon,
.topbar-search-section__item.is-active .item-type-icon {
  color: var(--a-color-primary);
}

.item-texts {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.topbar-search-section__title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-target-tag {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.1em 0.35em;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  flex-shrink: 0;
  border: 1px solid var(--a-color-border-soft);
}

.topbar-search-section__subtitle {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-enter-hint {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.topbar-search-section__item:hover .item-enter-hint,
.topbar-search-section__item.is-active .item-enter-hint {
  opacity: 1;
  transform: translateX(0);
  color: var(--a-color-fg);
}
</style>
