<template>
  <section class="setting-management-overview" aria-labelledby="management-overview-title">
    <div class="setting-management-overview__heading">
      <p class="settings-center__kicker">MODULES</p>
      <h2 id="management-overview-title">模块开关</h2>
      <p>控制各模块是否在站点开放，详细管理请到下方模块管理区。</p>
    </div>

    <div class="setting-management-overview__list" data-test="module-list">
      <article v-for="key in overviewModuleOrder" :key="key" class="setting-management-overview__row">
        <div class="setting-management-overview__main">
          <span class="setting-management-overview__icon" aria-hidden="true">
            <component :is="moduleIcons[key]" :size="17" stroke-width="1.8" />
          </span>
          <span class="setting-management-overview__copy">
            <strong>{{ moduleRooms[key].name }}</strong>
            <small>{{ moduleDescriptions[key] }}</small>
          </span>
        </div>

        <span class="setting-management-overview__state" :class="{ 'is-disabled': !access.modules[key].enabled }">
          {{ access.modules[key].enabled ? '已开启' : '已关闭' }}
        </span>

        <div class="setting-management-overview__switch-wrap">
          <label class="setting-management-overview__switch" :title="`${access.modules[key].enabled ? '关闭' : '开启'}${moduleRooms[key].name}模块`">
            <input
              v-model="access.modules[key].enabled"
              :data-test="`module-enabled-${key}`"
              type="checkbox"
              :aria-label="`${access.modules[key].enabled ? '关闭' : '开启'}${moduleRooms[key].name}模块`"
            />
            <span aria-hidden="true" />
          </label>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IconBook2 as Book, IconMessages as Messages, IconMicrophone2 as Microphone, IconMusic as Music, IconRss as Rss, IconVideo as Video } from '@tabler/icons-vue'
import { toRef, type Component } from 'vue'

import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import type { SiteAccess } from '@/config/siteAccess'

const props = defineProps<{
  access: SiteAccess
}>()

const access = toRef(props, 'access')
const overviewModuleOrder = moduleNavOrder
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
  grid-template-columns: minmax(0, 1fr) auto auto;
  min-height: 4.125rem;
  align-items: center;
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

.setting-management-overview__state {
  color: var(--a-color-success);
  font-size: 0.78rem;
  font-weight: var(--a-font-weight-strong);
  white-space: nowrap;
}

.setting-management-overview__state.is-disabled {
  color: var(--a-color-muted);
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

@media (max-width: 640px) {
  .setting-management-overview__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .setting-management-overview__state {
    display: none;
  }
}
</style>
