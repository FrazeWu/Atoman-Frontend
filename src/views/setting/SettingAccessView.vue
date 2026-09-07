<template>
  <section class="setting-access settings-center">
    <PSectionHeader title="站点设置" kicker="SITE ACCESS" description="控制功能开放范围和各模块的默认策略。" />

    <p v-if="error" class="setting-access__message setting-access__message--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="saved" class="setting-access__message" role="status">已保存</p>

    <SettingManagementOverview :access="draft" @open-detail="openDetail" />

    <div class="setting-access__actions">
      <PButton variant="secondary" to="/">返回首页</PButton>
      <PButton :loading="saving" loading-text="保存中..." @click="() => save()">保存设置</PButton>
    </div>

    <PSheet
      :show="selectedModule !== null"
      :title="selectedModuleTitle"
      panel-class="setting-access__detail-sheet"
      @close="closeDetail"
    >
      <div class="setting-access__detail-layout">
        <aside class="setting-access__detail-directory" aria-label="模块详情目录">
          <header>模块详情</header>
          <nav>
            <button
              v-for="key in detailModuleOrder"
              :key="key"
              type="button"
              :class="{ 'is-active': selectedModule === key }"
              :aria-current="selectedModule === key ? 'page' : undefined"
              @click="openDetail(key)"
            >
              {{ moduleRooms[key].name }}
            </button>
          </nav>
        </aside>

        <main v-if="selectedModule" class="setting-access__detail-main" :aria-labelledby="detailTitleId">
          <header class="setting-access__detail-header">
            <div class="setting-access__detail-title">
              <span class="setting-access__detail-icon" aria-hidden="true">
                <component :is="moduleIcons[selectedModule]" :size="18" stroke-width="1.8" />
              </span>
              <div>
                <p class="settings-center__kicker">{{ moduleKeyLabel(selectedModule) }}</p>
                <h2 :id="detailTitleId">{{ selectedModuleTitle }}</h2>
                <p>{{ moduleDescriptions[selectedModule] }}</p>
              </div>
            </div>
            <PButton variant="ghost" size="sm" title="关闭详情" aria-label="关闭详情" @click="() => closeDetail()">
              <X :size="18" aria-hidden="true" />
              关闭
            </PButton>
          </header>

          <div class="setting-access__detail-body" aria-live="polite">
            <template v-if="selectedModule === 'feed'">
              <div class="setting-access__detail-settings">
                <div>
                  <strong>全文抓取策略</strong>
                  <small>决定 external_rss 订阅源是否允许逐个开启全文抓取。</small>
                </div>
                <select v-model="draft.settings.feed.full_text_mode" aria-label="全文抓取策略">
                  <option value="per_source">按订阅源选择</option>
                  <option value="disabled">全局关闭</option>
                </select>
              </div>
              <SettingFeedSourcePanel
                :full-text-mode="draft.settings.feed.full_text_mode"
                :allow-add-source="draft.settings.feed.allow_add_source"
                :show-header="false"
              />
            </template>

            <template v-else-if="selectedModule === 'music'">
              <p v-if="!draft.modules.music.enabled || !draft.modules.music.features['music.review']" class="setting-access__detail-disabled" role="status">
                音乐审核已关闭，请先在站点设置首页开启对应开关。
              </p>
              <SettingMusicReviewPanel v-else />
            </template>

            <template v-else-if="selectedModule === 'forum'">
              <label class="setting-access__detail-settings">
                <span>
                  <strong>允许申请分类</strong>
                  <small>控制普通用户是否可以发起新分类申请。</small>
                </span>
                <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
              </label>
              <SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />
              <PButton variant="secondary" to="/site/setting/community">社区管理</PButton>
            </template>

          </div>
        </main>
      </div>
    </PSheet>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconBook2 as Book, IconMessages as Messages, IconMicrophone2 as Microphone, IconMusic as Music, IconRss as Rss, IconVideo as Video, IconX as X } from '@tabler/icons-vue'
import type { Component } from 'vue'

import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'
import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import SettingMusicReviewPanel from '@/components/setting/SettingMusicReviewPanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { mergeSiteAccess, siteAccessDetailModules, type SiteAccess } from '@/config/siteAccess'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const route = useRoute()
const router = useRouter()
const draft = ref<SiteAccess>(mergeSiteAccess(siteAccessStore.access))
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const selectedModule = ref<ModuleRoomKey | null>(null)

const detailModuleOrder = siteAccessDetailModules
const detailTitleId = 'site-setting-detail-title'
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
const selectedModuleTitle = computed(() => selectedModule.value ? `${moduleRooms[selectedModule.value].name}详情` : '')

watch(
  () => siteAccessStore.access,
  (access) => {
    draft.value = mergeSiteAccess(access)
  },
  { deep: true },
)

watch(
  () => draft.value.settings.forum.allow_category_request,
  (enabled) => {
    draft.value.modules.forum.features['category.request'] = enabled
  },
)

watch(() => route?.hash ?? '', syncDetailFromRoute, { immediate: true })

function moduleKeyLabel(key: ModuleRoomKey) {
  return `/${key.toUpperCase()}`
}

function isDetailModule(value: string): value is ModuleRoomKey {
  return detailModuleOrder.includes(value as ModuleRoomKey)
}

function openDetail(key: ModuleRoomKey, updateRoute = true) {
  selectedModule.value = key
  if (updateRoute && route?.hash !== `#detail-${key}`) {
    void router?.replace({ path: route?.path ?? '/site/setting', query: route?.query, hash: `#detail-${key}` })
  }
}

function closeDetail(updateRoute = true) {
  selectedModule.value = null
  if (updateRoute && route?.hash) {
    void router?.replace({ path: route?.path ?? '/site/setting', query: route?.query, hash: '' })
  }
}

function syncDetailFromRoute() {
  const hash = route?.hash ?? ''
  const match = hash.match(/^#(?:detail|module)-(.+)$/)
  if (match && isDetailModule(match[1])) {
    selectedModule.value = match[1]
    return
  }
  if (selectedModule.value) selectedModule.value = null
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''

  try {
    await siteAccessStore.save(mergeSiteAccess(draft.value), authStore.token)
    saved.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  } finally {
    saving.value = false
  }
}

</script>

<style scoped>
.setting-access {
  gap: 1.5rem;
}

.setting-access__message {
  margin: 0;
  color: var(--a-color-text);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__message--error {
  color: var(--a-color-danger);
}

.setting-access__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--a-color-bg) 0%, transparent), var(--a-color-bg) 28%);
}

.setting-access__detail-sheet :deep(.sheet-content--has-bookmark-close) {
  padding-left: 2rem;
  padding-right: 2rem;
}

.setting-access__detail-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--a-sidebar-width) minmax(0, 1fr);
  gap: 1.25rem;
}

.setting-access__detail-directory {
  position: sticky;
  top: 0;
  display: flex;
  width: var(--a-sidebar-width);
  max-height: calc(100dvh - var(--a-topbar-height) - 5rem);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.setting-access__detail-directory header {
  min-height: 3.375rem;
  padding: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__detail-directory nav {
  display: grid;
  gap: 0.125rem;
  overflow-y: auto;
  padding: 0.5rem;
}

.setting-access__detail-directory nav p {
  margin: 0;
  padding: 0.75rem 0.625rem 0.25rem;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__detail-directory button {
  position: relative;
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  padding: 0.5rem 0.625rem 0.5rem 0.875rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text-secondary);
  font: inherit;
  font-size: var(--a-text-sm);
  text-align: left;
  cursor: pointer;
}

.setting-access__detail-directory button:hover,
.setting-access__detail-directory button.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.setting-access__detail-directory button.is-active {
  font-weight: var(--a-font-weight-strong);
}

.setting-access__detail-directory button.is-active::before {
  position: absolute;
  left: 0.3125rem;
  width: 2px;
  height: 1.125rem;
  border-radius: 2px;
  background: var(--a-color-primary);
  content: "";
}

.setting-access__detail-main {
  min-width: 0;
}

.setting-access__detail-header {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-access__detail-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.setting-access__detail-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
}

.setting-access__detail-title h2,
.setting-access__detail-title p {
  margin: 0;
}

.setting-access__detail-title h2 {
  font-size: 1.15rem;
}

.setting-access__detail-title p:last-child {
  margin-top: 0.25rem;
  color: var(--a-color-text-secondary);
  font-size: 0.78rem;
}

.setting-access__detail-body {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
  padding-top: 1.25rem;
}

.setting-access__detail-settings {
  display: flex;
  min-height: 3.875rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-access__detail-settings > div,
.setting-access__detail-settings > span {
  display: grid;
  gap: 0.25rem;
}

.setting-access__detail-settings strong,
.setting-access__detail-settings small {
  display: block;
}

.setting-access__detail-settings small {
  color: var(--a-color-text-secondary);
  font-size: 0.75rem;
}

.setting-access__detail-settings select {
  min-height: 2.375rem;
  min-width: 10rem;
  padding: 0 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font: inherit;
  font-size: 0.75rem;
}

.setting-access__detail-settings input[type="checkbox"],
.setting-access__detail-settings input[type="radio"] {
  width: 1rem;
  height: 1rem;
  accent-color: var(--a-color-primary);
}

.setting-access__detail-settings--stack {
  display: grid;
  align-items: stretch;
  justify-content: stretch;
}

.setting-access__detail-settings--stack label {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-access__detail-empty {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 0;
}

.setting-access__detail-empty small {
  color: var(--a-color-text-secondary);
}

.setting-access__detail-disabled {
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text-secondary);
}

@media (max-width: 1023px) {
  .setting-access__detail-layout {
    grid-template-columns: 1fr;
  }

  .setting-access__detail-directory {
    position: static;
    width: 100%;
    max-height: none;
  }

  .setting-access__detail-directory nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .setting-access__detail-directory nav p {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .setting-access__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-access__detail-sheet :deep(.sheet-content--has-bookmark-close) {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .setting-access__detail-header {
    align-items: flex-start;
  }

  .setting-access__detail-settings {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-access__detail-settings select {
    width: 100%;
  }
}
</style>
