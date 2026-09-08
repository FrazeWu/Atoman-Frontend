<template>
  <section class="setting-access settings-center">
    <PSectionHeader title="站点设置" kicker="SITE ACCESS" description="控制功能开放范围和各模块的默认策略。" />

    <p v-if="error" class="setting-access__message setting-access__message--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="saved" class="setting-access__message" role="status">已保存</p>

    <section id="module-access" class="setting-access__management-section" aria-label="模块开关">
      <SettingManagementOverview :access="draft" />

      <div class="setting-access__actions">
        <PButton variant="secondary" to="/">返回首页</PButton>
        <PButton :loading="saving" loading-text="保存中..." @click="save">保存设置</PButton>
      </div>
    </section>

    <section id="users" class="setting-access__management-section" aria-label="用户管理">
      <SettingUsersView />
    </section>

    <section id="community" class="setting-access__management-section" aria-label="社区管理">
      <SettingCommunityView />
    </section>

    <section id="announcements" class="setting-access__management-section" aria-label="公告管理">
      <SettingAnnouncementsView />
    </section>

    <section id="module-management" class="setting-access__management-section" aria-label="模块管理">
      <PSectionHeader
        title="模块管理"
        kicker="MODULE MANAGEMENT"
        description="从这里进入各模块的详细管理，详情内容不会直接铺在本页。"
      />

      <div class="setting-access__module-list">
        <article
          v-for="key in moduleOrder"
          :id="getSectionDomId(key)"
          :key="key"
          class="setting-access__module-card"
          :aria-labelledby="`${getSectionDomId(key)}-title`"
        >
          <div class="setting-access__module-card-title">
            <span class="setting-access__module-icon" aria-hidden="true">
              <component :is="moduleIcons[key]" :size="18" stroke-width="1.8" />
            </span>
            <div>
              <p class="settings-center__kicker">/{{ key.toUpperCase() }}</p>
              <h3 :id="`${getSectionDomId(key)}-title`">{{ moduleRooms[key].name }}</h3>
              <p>{{ moduleDescriptions[key] }}</p>
            </div>
          </div>

          <div class="setting-access__module-card-actions">
            <span class="setting-access__module-state" :class="{ 'is-disabled': !draft.modules[key].enabled }">
              {{ draft.modules[key].enabled ? '模块已开启' : '模块已关闭' }}
            </span>
            <PButton
              v-if="hasDetail(key)"
              :data-test="`module-manage-${key}`"
              variant="secondary"
              size="sm"
              @click="openDetail(key)"
            >
              管理
            </PButton>
            <span v-else class="setting-access__module-unavailable">暂无独立管理项</span>
          </div>
        </article>
      </div>
    </section>

    <PSheet
      :show="selectedModule !== null"
      :title="selectedModuleTitle"
      mode="full"
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
                <span>
                  <strong>允许订阅管理</strong>
                  <small>控制管理员是否可以维护站点订阅源。</small>
                </span>
                <input v-model="draft.modules.feed.features['subscription.manage']" type="checkbox" />
              </div>
              <div class="setting-access__detail-settings">
                <span>
                  <strong>允许维护订阅源</strong>
                  <small>控制管理员是否可以编辑、隐藏和刷新订阅源。</small>
                </span>
                <input v-model="draft.settings.feed.allow_manage_sources" type="checkbox" />
              </div>
              <div class="setting-access__detail-settings">
                <span>
                  <strong>允许添加订阅源</strong>
                  <small>控制管理员是否可以添加新的 RSS 订阅源。</small>
                </span>
                <input v-model="draft.settings.feed.allow_add_source" type="checkbox" />
              </div>
              <div class="setting-access__detail-settings">
                <span>
                  <strong>全文抓取策略</strong>
                  <small>决定 external_rss 订阅源是否允许逐个开启全文抓取。</small>
                </span>
                <select v-model="draft.settings.feed.full_text_mode" aria-label="全文抓取策略">
                  <option value="per_source">按订阅源选择</option>
                  <option value="disabled">全局关闭</option>
                </select>
              </div>
              <SettingFeedSourcePanel
                v-if="draft.modules.feed.enabled && draft.modules.feed.features['subscription.manage']"
                :full-text-mode="draft.settings.feed.full_text_mode"
                :allow-add-source="draft.settings.feed.allow_add_source"
                :show-header="false"
              />
              <p v-else class="setting-access__detail-disabled" role="status">请先开启订阅模块和订阅管理权限。</p>
            </template>

            <template v-else-if="selectedModule === 'music'">
              <div class="setting-access__detail-settings setting-access__detail-settings--stack">
                <label>
                  <span>
                    <strong>允许提交音乐资料</strong>
                    <small>控制用户是否可以提交专辑、歌曲和艺人资料。</small>
                  </span>
                  <input v-model="draft.modules.music.features['music.submit']" type="checkbox" />
                </label>
                <label>
                  <span>
                    <strong>允许音乐审核</strong>
                    <small>控制管理员是否可以处理音乐资料和状态请求。</small>
                  </span>
                  <input v-model="draft.modules.music.features['music.review']" type="checkbox" />
                </label>
              </div>
              <p v-if="!draft.modules.music.enabled || !draft.modules.music.features['music.review']" class="setting-access__detail-disabled" role="status">
                音乐审核已关闭，请先开启音乐模块和音乐审核权限。
              </p>
              <SettingMusicReviewPanel v-else />
            </template>

            <template v-else-if="selectedModule === 'forum'">
              <div class="setting-access__detail-settings setting-access__detail-settings--stack">
                <label>
                  <span>
                    <strong>允许发布话题</strong>
                    <small>控制普通用户是否可以在论坛发起话题。</small>
                  </span>
                  <input v-model="draft.modules.forum.features['topic.create']" type="checkbox" />
                </label>
                <label>
                  <span>
                    <strong>允许申请分类</strong>
                    <small>控制普通用户是否可以发起新分类申请。</small>
                  </span>
                  <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
                </label>
              </div>
              <SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />
              <p v-else class="setting-access__detail-disabled" role="status">论坛模块已关闭，请先开启论坛模块。</p>
            </template>
          </div>
        </main>
      </div>
    </PSheet>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconBook2 as Book, IconMessages as Messages, IconMicrophone2 as Microphone, IconMusic as Music, IconRss as Rss, IconVideo as Video, IconX as X } from '@tabler/icons-vue'

import SettingAnnouncementsView from '@/views/setting/SettingAnnouncementsView.vue'
import SettingCommunityView from '@/views/setting/SettingCommunityView.vue'
import SettingUsersView from '@/views/setting/SettingUsersView.vue'
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'
import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import SettingMusicReviewPanel from '@/components/setting/SettingMusicReviewPanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { mergeSiteAccess, siteAccessDetailModules, type SiteAccess } from '@/config/siteAccess'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { getSectionDomId, resolveInitialSettingSection } from '@/views/setting/settingAccessSections'
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

const moduleOrder = moduleNavOrder
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

watch(() => route.hash, () => {
  syncDetailFromRoute()
  scrollToRouteSection()
}, { immediate: true })

function moduleKeyLabel(key: ModuleRoomKey) {
  return `/${key.toUpperCase()}`
}

function hasDetail(key: ModuleRoomKey) {
  return detailModuleOrder.includes(key)
}

function isDetailModule(value: string): value is ModuleRoomKey {
  return detailModuleOrder.includes(value as ModuleRoomKey)
}

function openDetail(key: ModuleRoomKey, updateRoute = true) {
  if (!hasDetail(key)) return
  selectedModule.value = key
  if (updateRoute && route.hash !== `#detail-${key}`) {
    void router.replace({ path: '/site/setting', query: route.query, hash: `#detail-${key}` })
  }
}

function closeDetail(updateRoute = true) {
  selectedModule.value = null
  if (updateRoute && route.hash) {
    void router.replace({ path: '/site/setting', query: route.query, hash: '' })
  }
}

function syncDetailFromRoute() {
  const match = route.hash.match(/^#(?:detail|module)-(.+)$/)
  if (match && isDetailModule(match[1])) {
    selectedModule.value = match[1]
    return
  }
  selectedModule.value = null
}

function routeSectionId(hash: string) {
  if (['#module-access', '#users', '#community', '#announcements', '#module-management'].includes(hash)) {
    return hash.slice(1)
  }
  const key = resolveInitialSettingSection(hash)
  return key && moduleOrder.includes(key) ? getSectionDomId(key) : null
}

function scrollToRouteSection() {
  const id = routeSectionId(route.hash)
  if (!id) return
  void nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
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

onMounted(scrollToRouteSection)
</script>

<style scoped>
.setting-access {
  gap: 2rem;
}

.setting-access__message {
  margin: 0;
  color: var(--a-color-text);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__message--error {
  color: var(--a-color-danger);
}

.setting-access__management-section {
  display: grid;
  gap: 1.25rem;
  scroll-margin-top: 5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-access__management-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}

.setting-access__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.setting-access__module-list {
  display: grid;
  gap: 1rem;
}

.setting-access__module-card {
  display: grid;
  min-height: 7rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  scroll-margin-top: 5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.setting-access__module-card-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.875rem;
}

.setting-access__module-card-title h3,
.setting-access__module-card-title p {
  margin: 0;
}

.setting-access__module-card-title h3 {
  font-size: 1.05rem;
}

.setting-access__module-card-title p:last-child {
  margin-top: 0.25rem;
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
}

.setting-access__module-icon,
.setting-access__detail-icon {
  display: grid;
  width: 2.375rem;
  height: 2.375rem;
  flex: 0 0 2.375rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
}

.setting-access__module-card-actions {
  display: flex;
  min-width: 9rem;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
}

.setting-access__module-state {
  color: var(--a-color-success);
  font-size: 0.78rem;
  font-weight: var(--a-font-weight-strong);
  white-space: nowrap;
}

.setting-access__module-state.is-disabled {
  color: var(--a-color-muted);
}

.setting-access__module-unavailable {
  color: var(--a-color-muted);
  font-size: 0.78rem;
  white-space: nowrap;
}

.setting-access__detail-sheet :deep(.sheet-content--has-bookmark-close) {
  padding-left: 2rem;
  padding-right: 2rem;
}

.setting-access__detail-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: max(12rem, var(--a-sidebar-width)) minmax(0, 1fr);
  gap: 1.25rem;
}

.setting-access__detail-directory {
  position: sticky;
  top: 0;
  display: flex;
  width: max(12rem, var(--a-sidebar-width));
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

.setting-access__detail-settings > span {
  display: grid;
  gap: 0.25rem;
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

.setting-access__detail-settings input[type="checkbox"] {
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
}

@media (max-width: 640px) {
  .setting-access__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-access__module-card {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .setting-access__module-card-actions {
    justify-content: space-between;
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
