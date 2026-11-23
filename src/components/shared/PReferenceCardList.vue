<template>
  <section
    v-if="cards.length"
    class="p-reference-card-list"
    :class="{ 'is-compact': compact }"
    :aria-label="heading || '引用来源'"
    data-test="reference-card-list"
    @click.stop
  >
    <h3 v-if="heading && !compact" class="p-reference-card-list__heading">{{ heading }}</h3>
    <div class="p-reference-card-list__items">
      <template v-for="card in cards" :key="card.key">
        <a
          v-if="card.available && card.href !== '#'"
          :href="card.href"
          class="p-ref-card"
          data-test="reference-card"
          @click="handleCardClick($event, card.href)"
        >
          <div class="p-ref-card__badges">
            <span class="p-ref-card__type">{{ card.typeLabel }}</span>
            <span
              v-if="card.relation?.stance === 'support'"
              class="p-ref-card__stance p-ref-card__stance--support"
            >支撑</span>
            <span
              v-else-if="card.relation?.stance === 'oppose'"
              class="p-ref-card__stance p-ref-card__stance--oppose"
            >反驳</span>
            <span
              v-if="card.relation?.state === 'stale'"
              class="p-ref-card__stale"
            >来源结论已变化</span>
          </div>
          <p class="p-ref-card__title">{{ card.label }}</p>
          <p v-if="card.excerpt" class="p-ref-card__excerpt">{{ card.excerpt }}</p>
          <div v-if="card.sourceName || card.dateText" class="p-ref-card__meta">
            <span v-if="card.sourceName" class="p-ref-card__source">{{ card.sourceName }}</span>
            <span v-if="card.sourceName && card.dateText" class="p-ref-card__sep" aria-hidden="true">·</span>
            <time v-if="card.dateText" :datetime="card.publishedAt" class="p-ref-card__date">{{ card.dateText }}</time>
          </div>
        </a>

        <div
          v-else
          class="p-ref-card is-unavailable"
          data-test="reference-card-unavailable"
        >
          <div class="p-ref-card__badges">
            <span class="p-ref-card__type">{{ card.typeLabel }}</span>
            <span
              v-if="card.relation?.stance === 'support'"
              class="p-ref-card__stance p-ref-card__stance--support"
            >支撑</span>
            <span
              v-else-if="card.relation?.stance === 'oppose'"
              class="p-ref-card__stance p-ref-card__stance--oppose"
            >反驳</span>
            <span
              v-if="card.relation?.state === 'stale'"
              class="p-ref-card__stale"
            >来源结论已变化</span>
          </div>
          <p v-if="card.label" class="p-ref-card__title p-ref-card__title--muted">{{ card.label }}</p>
          <p class="p-ref-card__unavailable-note">该引用来源已删除或不可访问</p>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import * as vueRouter from 'vue-router'
import type { ReferenceTargetType, ResolvedReference } from '@/api/references'
import { referenceHref } from '@/composables/useReferenceRendering'
import type { ContentReference, DebateReferenceRelation } from '@/types'

type ReferenceItem = ResolvedReference | ContentReference

const props = withDefaults(defineProps<{
  references: ReadonlyArray<ReferenceItem>
  excludeUsers?: boolean
  compact?: boolean
  heading?: string
}>(), {
  excludeUsers: true,
  compact: false,
  heading: '引用来源',
})

function getSafeRouter() {
  try {
    if (typeof vueRouter.useRouter === 'function') {
      return vueRouter.useRouter()
    }
  } catch {
    // Allow rendering in isolated unit tests without router installation.
  }
  return undefined
}

const router = getSafeRouter()

const resourceTypeLabels: Record<string, string> = {
  post: '文章',
  short_note: '短笺',
  thread: '主题',
  debate: '辩题',
  feed: '订阅源',
  article: '资讯',
  artist: '艺术家',
  album: '专辑',
  song: '歌曲',
  playlist: '歌单',
  podcast: '播客',
  episode: '单集',
  video: '视频',
  person: '人物',
  event: '事件',
  channel: '频道',
  collection: '合集',
  comment: '评论',
  user: '用户',
}

interface ReferenceCardItem {
  key: string
  targetType: string
  targetId: string
  typeLabel: string
  label: string
  excerpt: string
  sourceName: string
  publishedAt?: string
  dateText: string
  href: string
  available: boolean
  relation?: DebateReferenceRelation
}

function isContentReference(item: ReferenceItem): item is ContentReference {
  return 'target' in item
}

function formatCardDate(value?: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

const cards = computed<ReferenceCardItem[]>(() => {
  const seen = new Set<string>()
  const result: ReferenceCardItem[] = []

  for (const item of props.references || []) {
    let targetType: string
    let isUser: boolean
    let targetId: string
    let rawLabel: string
    let available: boolean
    let module: string | undefined
    let path: string | undefined
    let excerpt: string
    let subtitle: string
    let sourceName: string
    let publishedAt: string | undefined
    let relation: DebateReferenceRelation | undefined

    if (isContentReference(item)) {
      targetType = item.target.type
      isUser = (item.target.type as string) === 'user'
      targetId = item.target.id
      rawLabel = item.target.label
      available = Boolean(item.target.available)
      module = item.target.module
      path = item.target.path
      excerpt = item.target.excerpt?.trim() || ''
      subtitle = item.target.subtitle?.trim() || ''
      sourceName = item.target.source_name?.trim() || subtitle
      publishedAt = item.target.published_at
      relation = item.relation
    } else {
      targetType = item.target_type
      isUser = item.kind === 'user' || item.target_type === 'user'
      targetId = item.target_id || ''
      rawLabel = item.label || item.subtitle || ''
      available = Boolean(item.available)
      module = item.module
      path = item.path
      excerpt = item.excerpt?.trim() || ''
      subtitle = item.subtitle?.trim() || ''
      sourceName = item.source_name?.trim() || subtitle
      publishedAt = item.published_at
    }

    if (props.excludeUsers && isUser) continue

    const label = rawLabel.trim()
    const dedupKey = `${targetType}:${targetId || label}`
    if (!targetType || seen.has(dedupKey)) continue
    seen.add(dedupKey)

    const href = available
      ? referenceHref({
        module,
        path,
      })
      : '#'

    result.push({
      key: dedupKey,
      targetType: targetType as ReferenceTargetType,
      targetId,
      typeLabel: resourceTypeLabels[targetType] || targetType,
      label: label || (targetId ? `${resourceTypeLabels[targetType] || targetType}` : ''),
      excerpt,
      sourceName,
      publishedAt,
      dateText: formatCardDate(publishedAt),
      href,
      available,
      relation,
    })
  }

  return result
})

function handleCardClick(event: MouseEvent, href: string) {
  event.stopPropagation()
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return
  }
  if (href.startsWith('/') && !href.startsWith('//') && router && typeof router.push === 'function') {
    event.preventDefault()
    void router.push(href)
  }
}
</script>

<style scoped>
.p-reference-card-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 1.25rem;
}

.p-reference-card-list.is-compact {
  gap: 0.45rem;
  margin-top: 0.5rem;
}

.p-reference-card-list__heading {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-muted);
  letter-spacing: 0.02em;
}

.p-reference-card-list__items {
  display: grid;
  gap: 0.55rem;
}

.p-reference-card-list.is-compact .p-reference-card-list__items {
  gap: 0.45rem;
}

.p-ref-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg-subtle, rgba(15, 23, 42, 0.02));
  color: var(--a-color-fg);
  text-decoration: none;
  box-shadow: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

a.p-ref-card:hover {
  border-color: var(--a-color-border-strong, var(--a-color-border));
  background: var(--a-color-bg-hover, rgba(15, 23, 42, 0.04));
}

.p-reference-card-list.is-compact .p-ref-card {
  padding: 0.55rem 0.75rem;
  gap: 0.25rem;
}

.p-ref-card.is-unavailable {
  opacity: 0.72;
  background: transparent;
}

.p-ref-card__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.p-ref-card__type {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.p-ref-card__stance,
.p-ref-card__stale {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.4rem;
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.6875rem;
  font-weight: 500;
}

.p-ref-card__stance--support {
  background: var(--a-color-success-soft, rgba(16, 185, 129, 0.1));
  color: var(--a-color-success, #059669);
}

.p-ref-card__stance--oppose {
  background: var(--a-color-danger-soft, rgba(239, 68, 68, 0.1));
  color: var(--a-color-danger, #dc2626);
}

.p-ref-card__stale {
  background: var(--a-color-warning-soft, rgba(245, 158, 11, 0.12));
  color: var(--a-color-warning, #b45309);
}

.p-ref-card__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-fg);
}

.p-ref-card__title--muted {
  color: var(--a-color-muted);
}

.p-ref-card__excerpt {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.p-ref-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
}

.p-ref-card__unavailable-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}
</style>
