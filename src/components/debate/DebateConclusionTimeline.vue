<template>
  <section v-if="items.length > 0" class="conclusion-timeline" aria-label="共识历史">
    <h2 class="conclusion-timeline__heading">共识记录</h2>
    <ol class="conclusion-timeline__list" role="list">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="conclusion-timeline__item"
        :class="{ 'is-latest': index === 0 }"
      >
        <span
          class="conclusion-timeline__badge"
          :class="item.direction === 'yes' ? 'is-yes' : 'is-no'"
          aria-hidden="true"
        >
          {{ item.direction === 'yes' ? '是' : '否' }}
        </span>
        <div class="conclusion-timeline__body">
          <div class="conclusion-timeline__label">
            <span v-if="index === 0" class="conclusion-timeline__current">当前结论</span>
            <span v-else class="conclusion-timeline__past">历史结论</span>
          </div>
          <div class="conclusion-timeline__votes" aria-label="投票分布">
            <span>{{ item.yes_votes }} 是</span>
            <span class="conclusion-timeline__sep" aria-hidden="true">/</span>
            <span>{{ item.no_votes }} 否</span>
            <span class="conclusion-timeline__sep" aria-hidden="true">·</span>
            <span>{{ item.total_votes }} 人</span>
          </div>
          <time
            class="conclusion-timeline__time"
            :datetime="item.created_at"
            :title="formatDateFull(item.created_at)"
          >
            {{ formatDate(item.created_at) }}
          </time>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { DebateConclusionEvent } from '@/types'

defineProps<{
  items: DebateConclusionEvent[]
}>()

function formatDate(isoString: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function formatDateFull(isoString: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}
</script>

<style scoped>
.conclusion-timeline {
  margin-top: 12px;
  padding: 20px;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.conclusion-timeline__heading {
  margin: 0 0 16px;
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.conclusion-timeline__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conclusion-timeline__item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.conclusion-timeline__badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.conclusion-timeline__badge.is-yes {
  background: color-mix(in srgb, var(--a-color-success) 15%, transparent);
  color: var(--a-color-success);
}

.conclusion-timeline__badge.is-no {
  background: color-mix(in srgb, var(--a-color-danger) 15%, transparent);
  color: var(--a-color-danger);
}

.conclusion-timeline__body {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding-top: 4px;
}

.conclusion-timeline__label {
  font-size: 12px;
  font-weight: 600;
}

.conclusion-timeline__current {
  color: var(--a-color-text);
}

.conclusion-timeline__past {
  color: var(--a-color-muted);
}

.conclusion-timeline__votes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--a-color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.conclusion-timeline__sep {
  color: var(--a-color-muted);
}

.conclusion-timeline__time {
  color: var(--a-color-muted);
  font-size: 11px;
}

/* 最新一条加深强调 */
.conclusion-timeline__item.is-latest .conclusion-timeline__badge {
  box-shadow: 0 0 0 2px var(--a-color-border);
}
</style>
