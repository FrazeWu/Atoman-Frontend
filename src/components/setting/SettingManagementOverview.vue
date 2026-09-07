<template>
  <section class="setting-management-overview" aria-labelledby="management-overview-title">
    <div class="setting-management-overview__heading">
      <div>
        <p class="settings-center__kicker">MODULES</p>
        <h2 id="management-overview-title">模块可用性</h2>
        <p>在这里直接调整模块开关和常用策略，复杂管理进入详情。</p>
      </div>
    </div>

    <div class="setting-management-overview__list" data-test="module-list">
      <article v-for="key in overviewModuleOrder" :key="key" class="setting-management-overview__row">
        <button
          type="button"
          class="setting-management-overview__main"
          :aria-label="`打开${moduleRooms[key].name}详情`"
          :data-test="`module-detail-${key}`"
          @click="openModuleDetail(key)"
        >
          <span class="setting-management-overview__icon" aria-hidden="true">
            <component :is="moduleIcons[key]" :size="17" stroke-width="1.8" />
          </span>
          <span class="setting-management-overview__copy">
            <strong>{{ moduleRooms[key].name }}</strong>
            <small>{{ moduleDescriptions[key] }}</small>
          </span>
          <ChevronRight class="setting-management-overview__arrow" :size="17" aria-hidden="true" />
        </button>

        <div class="setting-management-overview__quick">
          <select
            v-if="key === 'feed'"
            v-model="access.settings.feed.full_text_mode"
            aria-label="订阅全文抓取策略"
          >
            <option value="per_source">全文：按源设置</option>
            <option value="disabled">全文：暂停抓取</option>
          </select>

          <div v-else-if="key === 'music'" class="setting-management-overview__quick-stack">
            <label>
              <input v-model="access.modules.music.features['music.submit']" type="checkbox" />
              允许提交资料
            </label>
            <label>
              <input v-model="access.modules.music.features['music.review']" type="checkbox" />
              允许音乐审核
            </label>
          </div>

          <select
            v-else-if="key === 'blog'"
            v-model="access.settings.blog.comment_mode"
            aria-label="博客评论权限"
          >
            <option value="all">评论：所有人</option>
            <option value="authenticated">评论：仅登录用户</option>
            <option value="disabled">评论：关闭</option>
          </select>

          <select
            v-else-if="key === 'forum'"
            v-model="access.settings.forum.allow_category_request"
            aria-label="社区分类申请"
          >
            <option :value="true">分类申请：允许</option>
            <option :value="false">分类申请：关闭</option>
          </select>

          <span v-else class="setting-management-overview__quick-empty">无额外设置</span>
        </div>

        <div class="setting-management-overview__switch-wrap">
          <label class="setting-management-overview__switch" :title="`${access.modules[key].enabled ? '关闭' : '开启'}${moduleRooms[key].name}模块`">
            <input
              v-model="access.modules[key].enabled"
              :data-test="`module-enabled-${key}`"
              type="checkbox"
              :aria-label="`开启${moduleRooms[key].name}模块`"
            />
            <span aria-hidden="true" />
          </label>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IconBook2 as Book, IconChevronRight as ChevronRight, IconMessages as Messages, IconMicrophone2 as Microphone, IconMusic as Music, IconRss as Rss, IconVideo as Video } from '@tabler/icons-vue'
import { toRef, type Component } from 'vue'

import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import type { SiteAccess } from '@/config/siteAccess'

const props = defineProps<{
  access: SiteAccess
}>()

const emit = defineEmits<{
  'open-detail': [key: ModuleRoomKey]
}>()

const access = toRef(props, 'access')
const overviewModuleOrder: ModuleRoomKey[] = ['feed', 'music', 'blog', 'forum', 'podcast', 'video']
const moduleDescriptions: Record<ModuleRoomKey, string> = {
  feed: 'RSS、文章聚合与全文抓取',
  music: '音乐资料库与协作编辑',
  blog: '文章发布与评论',
  books: '书目与阅读',
  forum: '话题、分类与讨论',
  debate: '辩题与论点讨论',
  timeline: '人物与事件时间线',
  podcast: '音频节目与单集',
  video: '视频发布与播放',
}
const moduleIcons: Record<ModuleRoomKey, Component> = {
  feed: Rss,
  music: Music,
  blog: Book,
  books: Book,
  forum: Messages,
  debate: Messages,
  timeline: Book,
  podcast: Microphone,
  video: Video,
}

function openModuleDetail(key: ModuleRoomKey) {
  emit('open-detail', key)
}
</script>

<style scoped>
.setting-management-overview {
  display: grid;
  gap: 1rem;
}

.setting-management-overview__heading {
  display: grid;
  gap: 0.35rem;
}

.setting-management-overview__heading h2,
.setting-management-overview__heading p {
  margin: 0;
}

.setting-management-overview__heading h2 {
  font-size: 1.05rem;
}

.setting-management-overview__heading p:last-child {
  color: var(--a-color-text-secondary);
  font-size: 0.82rem;
}

.setting-management-overview__list {
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.setting-management-overview__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 14rem) auto;
  min-height: 4.125rem;
  align-items: stretch;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-management-overview__row:last-child {
  border-bottom: 0;
}

.setting-management-overview__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.setting-management-overview__main:hover {
  background: var(--a-color-surface-muted);
}

.setting-management-overview__icon {
  display: grid;
  width: 2.125rem;
  height: 2.125rem;
  flex: 0 0 2.125rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
}

.setting-management-overview__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.setting-management-overview__copy strong {
  font-size: 0.88rem;
  font-weight: 650;
}

.setting-management-overview__copy small {
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-management-overview__arrow {
  margin-left: auto;
  color: var(--a-color-muted);
}

.setting-management-overview__quick {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  padding: 0.6rem 0.5rem;
}

.setting-management-overview__quick select {
  width: 100%;
  min-height: 2.375rem;
  padding: 0 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font: inherit;
  font-size: 0.75rem;
}

.setting-management-overview__quick-stack {
  display: grid;
  width: 100%;
  gap: 0.3rem;
}

.setting-management-overview__quick-stack label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--a-color-text-secondary);
  font-size: 0.7rem;
  white-space: nowrap;
}

.setting-management-overview__quick-stack input {
  width: 0.9rem;
  height: 0.9rem;
  margin: 0;
  accent-color: var(--a-color-primary);
}

.setting-management-overview__quick-empty {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.setting-management-overview__switch-wrap {
  display: flex;
  align-items: center;
  padding: 0 1rem;
}

.setting-management-overview__switch {
  position: relative;
  display: inline-flex;
  width: 2.625rem;
  height: 1.625rem;
  cursor: pointer;
}

.setting-management-overview__switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.setting-management-overview__switch span {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--a-color-disabled-border);
  transition: background-color 0.15s ease;
}

.setting-management-overview__switch span::after {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--a-color-bg);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--a-color-text) 25%, transparent);
  content: "";
  transition: transform 0.15s ease;
}

.setting-management-overview__switch input:checked + span {
  background: var(--a-color-primary);
}

.setting-management-overview__switch input:checked + span::after {
  transform: translateX(1rem);
}

.setting-management-overview__switch input:focus-visible + span {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .setting-management-overview__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .setting-management-overview__quick {
    grid-column: 1 / -1;
    justify-content: stretch;
    padding: 0 1rem 0.75rem 4rem;
  }

  .setting-management-overview__quick select,
  .setting-management-overview__quick-stack {
    max-width: 18rem;
  }
}
</style>
