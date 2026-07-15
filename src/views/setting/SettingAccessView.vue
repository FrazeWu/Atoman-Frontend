<template>
  <section class="setting-access">
    <header class="setting-access__page-head">
      <div>
        <h2>模块与访问</h2>
        <p>从上到下完成全部站点配置。</p>
      </div>
      <div class="setting-access__save-top">
        <PButton :loading="saving" loading-text="保存中..." @click="save">保存更改</PButton>
      </div>
    </header>

    <p v-if="error" class="setting-access__message setting-access__message--error" role="alert">{{ error }}</p>
    <p v-else-if="saved" class="setting-access__message" role="status">设置已保存</p>

    <PButton
      class="setting-access__directory-trigger"
      variant="secondary"
      size="sm"
      @click="mobileDirectoryOpen = true"
    >
      <ListTree :size="16" aria-hidden="true" />
      目录
    </PButton>

    <div class="setting-access__layout" :class="{ 'is-directory-collapsed': directoryCollapsed }">
      <div class="setting-access__sections">
        <section
          v-for="(key, index) in moduleNavOrder"
          :id="`module-${key}`"
          :key="key"
          :ref="(el) => registerSection(key, el)"
          class="setting-access__section"
        >
          <header class="setting-access__section-head">
            <div>
              <p class="setting-access__section-index">{{ sectionIndex(index) }}</p>
              <h3>{{ moduleRooms[key].name }}</h3>
              <p>{{ moduleRooms[key].helper }}</p>
            </div>
            <span class="setting-access__state">
              <span class="setting-access__state-dot" :class="{ 'is-off': !draft.modules[key].enabled }" aria-hidden="true" />
              {{ draft.modules[key].enabled ? '已开放' : '已关闭' }}
            </span>
          </header>

          <div class="setting-access__settings">
            <label class="setting-access__setting-row">
              <span>
                <strong>模块开放</strong>
                <small>控制站内入口和相关功能</small>
              </span>
              <input
                v-model="draft.modules[key].enabled"
                class="setting-access__module-enabled"
                type="checkbox"
              />
            </label>

            <template v-if="key === 'feed'">
              <div class="setting-access__setting-row setting-access__setting-row--stack">
                <span>
                  <strong>全文抓取</strong>
                  <small>设置外部订阅源的抓取方式</small>
                </span>
                <div class="setting-access__choice-list">
                  <label v-for="mode in feedFullTextModes" :key="mode.value" class="setting-access__choice">
                    <input v-model="draft.settings.feed.full_text_mode" type="radio" :value="mode.value" />
                    <span><strong>{{ mode.label }}</strong><small>{{ mode.description }}</small></span>
                  </label>
                </div>
              </div>
              <div class="setting-access__embedded-panel">
                <SettingFeedSourcePanel :full-text-mode="draft.settings.feed.full_text_mode" />
              </div>
            </template>

            <div v-else-if="key === 'media'" class="setting-access__setting-row setting-access__setting-row--stack">
              <span>
                <strong>评论权限</strong>
                <small>控制文章评论开放范围</small>
              </span>
              <div class="setting-access__choice-list">
                <label v-for="mode in blogCommentModes" :key="mode.value" class="setting-access__choice">
                  <input v-model="draft.settings.blog.comment_mode" type="radio" :value="mode.value" />
                  <span><strong>{{ mode.label }}</strong><small>{{ mode.description }}</small></span>
                </label>
              </div>
            </div>

            <template v-else-if="key === 'forum'">
              <label class="setting-access__setting-row">
                <span>
                  <strong>申请分类</strong>
                  <small>允许普通用户发起新分类申请</small>
                </span>
                <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
              </label>
              <div v-if="draft.modules.forum.enabled" class="setting-access__embedded-panel">
                <SettingForumModeratorPanel />
              </div>
            </template>

            <div v-else class="setting-access__setting-row">
              <span><strong>其他设置</strong></span>
              <small class="setting-access__empty-setting">暂无</small>
            </div>
          </div>
        </section>

        <footer class="setting-access__footer">
          <span>更改将在保存后生效</span>
          <PButton :loading="saving" loading-text="保存中..." @click="save">保存更改</PButton>
        </footer>
      </div>

      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryItems"
        :active-id="activeSection"
        :mobile-open="mobileDirectoryOpen"
        aria-label="模块目录"
        @select="scrollToSection"
        @close-mobile="mobileDirectoryOpen = false"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ListTree } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { mergeSiteAccess, type SiteAccess } from '@/config/siteAccess'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { getSectionDomId, resolveActiveSectionByScroll } from '@/views/setting/settingAccessSections'

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()

const draft = ref<SiteAccess>(mergeSiteAccess(siteAccessStore.access))
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const activeSection = ref<ModuleRoomKey>('feed')
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const directoryItems = moduleNavOrder.map(key => ({ id: key, label: moduleRooms[key].name }))

const feedFullTextModes = [
  { value: 'per_source', label: '按订阅源设置', description: '由管理员逐个设置全文抓取。' },
  { value: 'disabled', label: '关闭全文抓取', description: '所有订阅源都不抓取全文。' },
] as const

const blogCommentModes = [
  { value: 'all', label: '全部用户', description: '游客和已登录用户均可评论。' },
  { value: 'authenticated', label: '仅登录用户', description: '登录后才可发表评论。' },
  { value: 'disabled', label: '关闭评论', description: '隐藏文章评论入口。' },
] as const

const sectionMap = new Map<ModuleRoomKey, HTMLElement>()
let ticking = false

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

function sectionIndex(index: number) {
  return String(index + 1).padStart(2, '0')
}

function scrollToSection(key: ModuleRoomKey) {
  document.getElementById(getSectionDomId(key))?.scrollIntoView({ block: 'start' })
  activeSection.value = key
  mobileDirectoryOpen.value = false
}

function registerSection(key: ModuleRoomKey, element: Element | { $el?: Element | null } | null) {
  const resolved = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null

  if (resolved) sectionMap.set(key, resolved)
  else sectionMap.delete(key)
}

function syncActiveSection() {
  const positions = moduleNavOrder
    .map((key) => {
      const element = sectionMap.get(key) ?? document.getElementById(getSectionDomId(key))
      return element ? { key, top: element.getBoundingClientRect().top + window.scrollY } : null
    })
    .filter((entry): entry is { key: ModuleRoomKey; top: number } => Boolean(entry))

  const nextActive = resolveActiveSectionByScroll(positions, window.scrollY, 180)
  if (nextActive) activeSection.value = nextActive
}

function handleScroll() {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    syncActiveSection()
    ticking = false
  })
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''

  try {
    await siteAccessStore.save(mergeSiteAccess(draft.value), authStore.token)
    saved.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  nextTick(syncActiveSection)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
})
</script>

<style scoped>
.setting-access {
  display: grid;
  gap: 1.25rem;
}

.setting-access__page-head,
.setting-access__section-head,
.setting-access__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.setting-access__page-head h2,
.setting-access__page-head p,
.setting-access__section-head h3,
.setting-access__section-head p {
  margin: 0;
}

.setting-access__page-head h2 {
  font-size: 1.5rem;
}

.setting-access__page-head p,
.setting-access__section-head > div > p:last-child {
  color: var(--a-color-ink-muted);
}

.setting-access__message {
  margin: 0;
  padding: 0.75rem 0;
  border-top: 1px solid var(--a-color-line-soft);
  border-bottom: 1px solid var(--a-color-line-soft);
  color: var(--a-color-ink-muted);
}

.setting-access__message--error {
  color: var(--a-color-danger-ink);
}

.setting-access__directory-trigger {
  display: none;
  justify-self: start;
}

.setting-access__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13.75rem;
  gap: 2rem;
  align-items: start;
  transition: grid-template-columns 0.2s ease;
}

.setting-access__layout.is-directory-collapsed {
  grid-template-columns: minmax(0, 1fr) 3rem;
}

.setting-access__sections {
  min-width: 0;
}

.setting-access__section {
  scroll-margin-top: 5rem;
  padding: 2rem 0;
  border-top: 1px solid var(--a-color-line);
}

.setting-access__section:first-child {
  border-top: 2px solid var(--a-color-ink);
}

.setting-access__section-index {
  margin-bottom: 0.5rem !important;
  color: var(--a-color-muted-soft) !important;
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: var(--a-font-weight-strong);
}

.setting-access__section-head h3 {
  font-size: 1.25rem;
}

.setting-access__state {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2rem;
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
  white-space: nowrap;
}

.setting-access__state-dot {
  width: 0.45rem;
  height: 0.45rem;
  background: #177245;
}

.setting-access__state-dot.is-off {
  background: var(--a-color-muted-soft);
}

.setting-access__settings {
  margin-top: 1.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.setting-access__setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(13rem, 18rem);
  gap: 1.5rem;
  align-items: center;
  min-height: 4rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-access__setting-row > span > strong,
.setting-access__setting-row > span > small,
.setting-access__choice strong,
.setting-access__choice small {
  display: block;
}

.setting-access__setting-row small,
.setting-access__choice small {
  color: var(--a-color-ink-muted);
}

.setting-access__setting-row > input[type='checkbox'] {
  justify-self: end;
}

.setting-access__setting-row input[type='checkbox'],
.setting-access__choice input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--a-color-ink);
}

.setting-access__setting-row--stack {
  align-items: start;
}

.setting-access__choice-list {
  display: grid;
  border: 1px solid var(--a-color-line-soft);
}

.setting-access__choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  padding: 0.75rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.setting-access__choice:last-child {
  border-bottom: 0;
}

.setting-access__embedded-panel {
  padding: 1.5rem 0;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-access__empty-setting {
  justify-self: end;
}

.setting-access__footer {
  position: static;
  align-items: center;
  padding: 0.75rem 0;
  border-top: 1px solid var(--a-color-line);
  background: var(--a-color-bg);
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-xs);
}

@media (max-width: 1023px) {
  .setting-access__layout,
  .setting-access__layout.is-directory-collapsed {
    grid-template-columns: 1fr;
  }

  .setting-access__directory-trigger {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .setting-access__page-head {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-access__save-top {
    display: none;
  }

  .setting-access__setting-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .setting-access__setting-row > input[type='checkbox'],
  .setting-access__empty-setting {
    justify-self: start;
  }
}
</style>
