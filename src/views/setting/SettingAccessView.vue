<template>
  <section class="setting-access settings-center">
    <PSectionHeader title="站点设置" kicker="SITE ACCESS" description="控制功能开放范围和各模块的默认策略。" />

    <p v-if="error" class="setting-access__message setting-access__message--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="saved" class="setting-access__message" role="status">已保存</p>

    <section id="module-access" class="setting-access__management-section" aria-label="模块开关">
      <SettingManagementOverview :access="draft" @open-detail="scrollToModule" />

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
        description="在这里展开各模块的详细管理。没有独立管理能力的模块只显示已有权限设置。"
      />

      <div class="setting-access__module-list">
        <section
          v-for="key in moduleOrder"
          :id="getSectionDomId(key)"
          :key="key"
          class="setting-access__module-section"
          :aria-labelledby="`${getSectionDomId(key)}-title`"
        >
          <header class="setting-access__module-header">
            <div class="setting-access__module-title">
              <span class="setting-access__module-icon" aria-hidden="true">
                <component :is="moduleIcons[key]" :size="18" stroke-width="1.8" />
              </span>
              <div>
                <p class="settings-center__kicker">/{{ key.toUpperCase() }}</p>
                <h3 :id="`${getSectionDomId(key)}-title`">{{ moduleRooms[key].name }}</h3>
                <p>{{ moduleDescriptions[key] }}</p>
              </div>
            </div>
            <span class="setting-access__module-state" :class="{ 'is-disabled': !draft.modules[key].enabled }">
              {{ draft.modules[key].enabled ? '已开启' : '已关闭' }}
            </span>
          </header>

          <div class="setting-access__module-body">
            <div v-if="moduleFeatures(key).length" class="setting-access__feature-list" aria-label="模块权限">
              <label v-for="feature in moduleFeatures(key)" :key="feature.key" class="setting-access__feature-row">
                <span>{{ feature.label }}</span>
                <input
                  v-model="draft.modules[key].features[feature.key]"
                  :data-test="`module-feature-${feature.key}`"
                  type="checkbox"
                  :disabled="!draft.modules[key].enabled"
                />
              </label>
            </div>

            <template v-if="key === 'feed'">
              <template v-if="draft.modules.feed.enabled">
                <div class="setting-access__detail-settings">
                  <span>
                    <strong>允许管理订阅源</strong>
                    <small>控制管理员是否可以维护站点订阅源。</small>
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
                  :full-text-mode="draft.settings.feed.full_text_mode"
                  :allow-add-source="draft.settings.feed.allow_add_source"
                  :show-header="false"
                />
              </template>
              <p v-else class="setting-access__detail-disabled" role="status">订阅模块已关闭，开启模块后才能管理订阅源。</p>
            </template>

            <template v-else-if="key === 'music'">
              <template v-if="draft.modules.music.enabled && draft.modules.music.features['music.review']">
                <SettingMusicReviewPanel />
              </template>
              <p v-else class="setting-access__detail-disabled" role="status">音乐审核已关闭，请先在上方开启音乐模块和音乐审核。</p>
            </template>

            <template v-else-if="key === 'blog'">
              <div class="setting-access__detail-settings">
                <span>
                  <strong>评论权限</strong>
                  <small>控制博客文章允许哪些用户发表评论。</small>
                </span>
                <select v-model="draft.settings.blog.comment_mode" aria-label="博客评论权限" :disabled="!draft.modules.blog.enabled">
                  <option value="all">所有人</option>
                  <option value="authenticated">仅登录用户</option>
                  <option value="disabled">关闭评论</option>
                </select>
              </div>
            </template>

            <template v-else-if="key === 'forum'">
              <div class="setting-access__detail-settings">
                <span>
                  <strong>允许申请分类</strong>
                  <small>控制普通用户是否可以发起新分类申请。</small>
                </span>
                <input v-model="draft.settings.forum.allow_category_request" type="checkbox" :disabled="!draft.modules.forum.enabled" />
              </div>
              <SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />
              <p v-else class="setting-access__detail-disabled" role="status">论坛模块已关闭，开启模块后才能管理版主。</p>
            </template>

            <p v-else-if="!moduleFeatures(key).length" class="setting-access__detail-empty">
              <strong>暂无独立管理项</strong>
              <small>当前模块只提供上方的模块开关。</small>
            </p>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconBook2 as Book, IconMessages as Messages, IconMicrophone2 as Microphone, IconMusic as Music, IconRss as Rss, IconVideo as Video } from '@tabler/icons-vue'

import SettingAnnouncementsView from '@/views/setting/SettingAnnouncementsView.vue'
import SettingCommunityView from '@/views/setting/SettingCommunityView.vue'
import SettingUsersView from '@/views/setting/SettingUsersView.vue'
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'
import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import SettingMusicReviewPanel from '@/components/setting/SettingMusicReviewPanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { mergeSiteAccess, siteAccessFeatures, type SiteAccess } from '@/config/siteAccess'
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

const moduleOrder = moduleNavOrder
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

watch(() => route.hash, scrollToRouteSection, { immediate: true })

function moduleFeatures(key: ModuleRoomKey) {
  return (siteAccessFeatures[key] ?? []).filter((feature) => (
    key !== 'forum' || feature.key !== 'category.request'
  ))
}

function routeSectionId(hash: string) {
  if (hash === '#module-access' || hash === '#users' || hash === '#community' || hash === '#announcements' || hash === '#module-management') {
    return hash.slice(1)
  }
  const legacySectionAliases: Record<string, string> = {
    '#detail-users': 'users',
    '#detail-community': 'community',
    '#detail-announcements': 'announcements',
  }
  if (legacySectionAliases[hash]) return legacySectionAliases[hash]
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

function scrollToModule(key: ModuleRoomKey) {
  void router.replace({ path: '/site/setting', query: route.query, hash: `#module-${key}` })
  void nextTick(() => {
    document.getElementById(getSectionDomId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

.setting-access__module-section {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
  scroll-margin-top: 5rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.setting-access__module-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-access__module-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.setting-access__module-title h3,
.setting-access__module-title p {
  margin: 0;
}

.setting-access__module-title h3 {
  font-size: 1.1rem;
}

.setting-access__module-title p:last-child {
  margin-top: 0.25rem;
  color: var(--a-color-text-secondary);
  font-size: 0.78rem;
}

.setting-access__module-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary);
}

.setting-access__module-state {
  flex: 0 0 auto;
  color: var(--a-color-success);
  font-size: 0.78rem;
  font-weight: var(--a-font-weight-strong);
}

.setting-access__module-state.is-disabled {
  color: var(--a-color-muted);
}

.setting-access__module-body {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.setting-access__feature-list {
  display: grid;
  border-top: 1px solid var(--a-color-border-soft);
}

.setting-access__feature-row,
.setting-access__detail-settings {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-access__feature-row input,
.setting-access__detail-settings input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: var(--a-color-primary);
}

.setting-access__detail-settings > span {
  display: grid;
  gap: 0.25rem;
}

.setting-access__detail-settings small,
.setting-access__detail-empty small {
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

.setting-access__detail-empty {
  display: grid;
  gap: 0.3rem;
  padding: 1rem 0;
}

.setting-access__detail-disabled {
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text-secondary);
}

.setting-access__management-section :deep(.setting-users),
.setting-access__management-section :deep(.setting-community),
.setting-access__management-section :deep(.setting-announcements) {
  gap: 1.25rem;
  padding-bottom: 0;
}

@media (max-width: 640px) {
  .setting-access__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-access__module-header,
  .setting-access__detail-settings {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-access__detail-settings select {
    width: 100%;
  }
}
</style>
