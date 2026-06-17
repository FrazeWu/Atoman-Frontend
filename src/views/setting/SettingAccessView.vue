<template>
  <section class="setting-access">
    <PSectionHeader
      title="模块设置中心"
      kicker="SITE ACCESS"
      description="先统一决定哪些模块开放，再逐个模块配置已确认的设置项。左侧目录会跟随右侧滚动位置同步切换。"
    />

    <p v-if="error" class="setting-access__message setting-access__message--error">{{ error }}</p>
    <p v-else-if="saved" class="setting-access__message">已保存</p>

    <PSurface class="setting-access__module-toggle-bar" :layer="1">
      <div class="setting-access__bar-head">
        <div>
          <h2 class="a-title-sm">启用模块</h2>
          <p class="a-muted">模块总开关统一放在这里，不在下方模块章节重复出现。</p>
        </div>
      </div>

      <div class="setting-access__module-toggle-grid">
        <label
          v-for="key in moduleNavOrder"
          :key="key"
          class="setting-access__module-toggle-item"
        >
          <div>
            <strong>{{ moduleRooms[key].name }}</strong>
            <small>{{ moduleRooms[key].helper }}</small>
          </div>
          <input v-model="draft.modules[key].enabled" type="checkbox" />
        </label>
      </div>
    </PSurface>

    <div class="setting-access__shell">
      <aside class="setting-access__module-nav" aria-label="模块目录">
        <button
          v-for="key in moduleNavOrder"
          :key="key"
          type="button"
          class="setting-access__module-nav-item"
          :class="{ 'is-active': activeSection === key }"
          @click="scrollToSection(key)"
        >
          <span class="setting-access__module-nav-kicker">{{ moduleKeyLabel(key) }}</span>
          <strong>{{ moduleRooms[key].name }}</strong>
          <small>{{ moduleRooms[key].helper }}</small>
        </button>
      </aside>

      <div class="setting-access__sections">
        <section
          v-for="key in moduleNavOrder"
          :id="`module-${key}`"
          :key="key"
          :ref="(el) => registerSection(key, el)"
          class="setting-access__section"
        >
          <PSurface :layer="1" class="setting-access__section-card">
            <div class="setting-access__section-head">
              <div>
                <p class="setting-access__section-kicker">{{ moduleKeyLabel(key) }}</p>
                <h2>{{ moduleRooms[key].name }}</h2>
                <p>{{ moduleRooms[key].homepageSub }}</p>
              </div>
              <span class="setting-access__section-state">
                {{ draft.modules[key].enabled ? '模块开放中' : '模块已关闭' }}
              </span>
            </div>

            <p class="setting-access__module-helper">{{ moduleRooms[key].helper }}</p>

            <div v-if="key === 'feed'" class="setting-access__module-body">
              <div class="setting-access__setting-block">
                <div class="setting-access__setting-copy">
                  <strong>全文抓取策略</strong>
                  <small>决定 external_rss 订阅源是否允许逐个开启全文抓取。</small>
                </div>
                <div class="setting-access__setting-control setting-access__setting-control--stack">
                  <label class="setting-access__radio-row">
                    <input v-model="draft.settings.feed.full_text_mode" type="radio" value="per_source" />
                    <div>
                      <strong>按订阅源选择</strong>
                      <small>由管理员在每个订阅源上单独开关全文抓取。</small>
                    </div>
                  </label>
                  <label class="setting-access__radio-row">
                    <input v-model="draft.settings.feed.full_text_mode" type="radio" value="disabled" />
                    <div>
                      <strong>全局关闭</strong>
                      <small>所有订阅源都不再做全文抓取。</small>
                    </div>
                  </label>
                </div>
              </div>

              <SettingFeedSourcePanel :full-text-mode="draft.settings.feed.full_text_mode" />
            </div>

            <div v-else-if="key === 'blog'" class="setting-access__module-body">
              <div class="setting-access__setting-block">
                <div class="setting-access__setting-copy">
                  <strong>评论权限</strong>
                  <small>控制文章评论开放范围。</small>
                </div>
                <div class="setting-access__setting-control setting-access__setting-control--stack">
                  <label
                    v-for="mode in blogCommentModes"
                    :key="mode.value"
                    class="setting-access__radio-row"
                  >
                    <input v-model="draft.settings.blog.comment_mode" type="radio" :value="mode.value" />
                    <div>
                      <strong>{{ mode.label }}</strong>
                      <small>{{ mode.description }}</small>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div v-else-if="key === 'forum'" class="setting-access__module-body">
              <label class="setting-access__setting-block">
                <div class="setting-access__setting-copy">
                  <strong>申请分类</strong>
                  <small>控制普通用户是否可发起新分类申请。</small>
                </div>
                <div class="setting-access__setting-control">
                  <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
                </div>
              </label>

              <SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />
            </div>

            <div v-else class="setting-access__module-body">
              <div class="setting-access__setting-block">
                <div class="setting-access__setting-copy">
                  <strong>{{ moduleRooms[key].name }}</strong>
                  <small>这个模块先保留占位，后续按同样结构补具体设置。</small>
                </div>
                <div class="setting-access__setting-control">
                  <p class="setting-access__placeholder">暂未开放具体配置</p>
                </div>
              </div>
            </div>
          </PSurface>
        </section>
      </div>
    </div>

    <div class="setting-access__actions">
      <PButton variant="secondary" to="/">返回首页</PButton>
      <PButton :loading="saving" loading-text="保存中..." @click="save">保存设置</PButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
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

const blogCommentModes = [
  { value: 'all', label: '全部可评论', description: '游客可匿名评论，已登录用户正常署名。' },
  { value: 'authenticated', label: '仅登录用户可评论', description: '保持当前默认行为。' },
  { value: 'disabled', label: '关闭评论', description: '全站文章评论入口关闭。' },
] as const

const sectionMap = new Map<ModuleRoomKey, HTMLElement>()
let ticking = false

watch(
  () => siteAccessStore.access,
  (access) => {
    draft.value = mergeSiteAccess(access)
  },
  { deep: true }
)

watch(
  () => draft.value.settings.forum.allow_category_request,
  (enabled) => {
    draft.value.modules.forum.features['category.request'] = enabled
  }
)

function moduleKeyLabel(key: ModuleRoomKey) {
  return `/${key.toUpperCase()}`
}

function scrollToSection(key: ModuleRoomKey) {
  const target = document.getElementById(getSectionDomId(key))
  target?.scrollIntoView({ behavior: 'auto', block: 'start' })
  activeSection.value = key
}

function registerSection(key: ModuleRoomKey, element: Element | { $el?: Element | null } | null) {
  const resolved = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null

  if (!resolved) {
    sectionMap.delete(key)
    return
  }

  sectionMap.set(key, resolved)
}

function syncActiveSection() {
  const positions = moduleNavOrder
    .map((key) => {
      const element = sectionMap.get(key) ?? document.getElementById(getSectionDomId(key))
      if (!element) return null
      return {
        key,
        top: element.getBoundingClientRect().top + window.scrollY,
      }
    })
    .filter((entry): entry is { key: ModuleRoomKey; top: number } => Boolean(entry))

  const nextActive = resolveActiveSectionByScroll(positions, window.scrollY)
  if (nextActive) {
    activeSection.value = nextActive
  }
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
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  nextTick(() => {
    syncActiveSection()
  })
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
  gap: 1.5rem;
}

.setting-access__module-toggle-bar {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.setting-access__bar-head h2,
.setting-access__bar-head p {
  margin: 0;
}

.setting-access__module-toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.setting-access__module-toggle-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
}

.setting-access__module-toggle-item strong,
.setting-access__module-toggle-item small {
  display: block;
}

.setting-access__module-toggle-item small {
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-xs);
}

.setting-access__module-toggle-item input,
.setting-access__setting-block input,
.setting-access__radio-row input,
.setting-access__section-state input,
.setting-access__module-nav input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-ink);
}

.setting-access__shell {
  display: grid;
  grid-template-columns: minmax(220px, 240px) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.setting-access__module-nav {
  position: sticky;
  top: 1.5rem;
  display: grid;
  gap: 0.75rem;
}

.setting-access__module-nav-item {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  text-align: left;
  cursor: pointer;
}

.setting-access__module-nav-item.is-active {
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}

.setting-access__module-nav-item.is-active strong {
  text-decoration: underline;
}

.setting-access__module-nav-kicker,
.setting-access__section-kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.setting-access__module-nav-item strong {
  font-size: 1rem;
  font-weight: 950;
}

.setting-access__module-nav-item small {
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-xs);
}

.setting-access__sections {
  display: grid;
  gap: 1rem;
}

.setting-access__section {
  scroll-margin-top: 1.25rem;
}

.setting-access__section-card {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
}

.setting-access__section-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-access__section-head h2,
.setting-access__section-head p,
.setting-access__placeholder,
.setting-access__module-helper,
.setting-access__message {
  margin: 0;
}

.setting-access__section-head h2 {
  color: var(--a-color-ink);
  font-size: 1.45rem;
  font-weight: 950;
}

.setting-access__section-head p,
.setting-access__module-helper,
.setting-access__placeholder {
  color: var(--a-color-ink-muted);
  line-height: 1.6;
}

.setting-access__section-state {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
}

.setting-access__module-body {
  display: grid;
  gap: 1rem;
}

.setting-access__setting-block {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 360px);
  gap: 1rem;
  align-items: start;
  padding: 0.9rem 0;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-access__setting-copy strong,
.setting-access__setting-copy small,
.setting-access__radio-row strong,
.setting-access__radio-row small {
  display: block;
}

.setting-access__setting-copy strong,
.setting-access__radio-row strong {
  color: var(--a-color-ink);
  font-size: 0.96rem;
  font-weight: 900;
}

.setting-access__setting-copy small,
.setting-access__radio-row small {
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-sm);
  line-height: 1.5;
}

.setting-access__setting-control {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.setting-access__setting-control--stack {
  display: grid;
  gap: 0.5rem;
  justify-content: stretch;
}

.setting-access__radio-row {
  display: flex;
  gap: 0.75rem;
  align-items: start;
}

.setting-access__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--a-color-bg) 24%);
}

.setting-access__message {
  color: var(--a-color-ink);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__message--error {
  color: var(--a-color-danger-ink);
}

@media (max-width: 900px) {
  .setting-access__shell {
    grid-template-columns: 1fr;
  }

  .setting-access__module-nav {
    position: static;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
}

@media (max-width: 640px) {
  .setting-access__module-toggle-item,
  .setting-access__section-head,
  .setting-access__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-access__setting-block {
    grid-template-columns: 1fr;
  }

  .setting-access__setting-control {
    justify-content: flex-start;
  }
}
</style>
