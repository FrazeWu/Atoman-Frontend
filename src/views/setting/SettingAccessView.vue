<template>
  <section class="setting-access settings-center">
    <PSectionHeader title="站点设置" kicker="SITE ACCESS" description="管理模块开放状态与站点功能。" />

    <p v-if="error" class="setting-access__message setting-access__message--error">
      {{ error }}
    </p>
    <p v-else-if="saved" class="setting-access__message">已保存</p>

    <div class="setting-access__sections settings-center__sections">
      <SettingManagementOverview />

        <section
          v-for="key in moduleNavOrder"
          :id="`module-${key}`"
          :key="key"
          class="setting-access__section settings-center__section"
        >
          <PSurface :layer="1" class="setting-access__section-card settings-center__section-card">
            <div class="setting-access__section-head settings-center__section-head">
              <div>
                <p class="settings-center__kicker">{{ moduleKeyLabel(key) }}</p>
                <h2>{{ moduleRooms[key].name }}</h2>
                <p>{{ moduleRooms[key].homepageSub }}</p>
              </div>
              <span class="setting-access__section-state">
                {{ draft.modules[key].enabled ? '模块开放中' : '模块已关闭' }}
              </span>
            </div>

            <p class="setting-access__module-helper">
              {{ moduleRooms[key].helper }}
            </p>

            <label class="setting-access__module-enabled settings-block">
              <div class="settings-block__copy">
                <strong>模块开放</strong>
                <small>控制站内入口与相关功能。</small>
              </div>
              <div class="settings-block__control">
                <input
                  v-model="draft.modules[key].enabled"
                  :data-test="`module-enabled-${key}`"
                  type="checkbox"
                />
              </div>
            </label>

            <div v-if="key === 'feed'" class="setting-access__module-body">
              <div class="setting-access__setting-block settings-block">
                <div class="setting-access__setting-copy settings-block__copy">
                  <strong>全文抓取策略</strong>
                  <small>决定 external_rss 订阅源是否允许逐个开启全文抓取。</small>
                </div>
                <div class="setting-access__setting-control settings-block__control settings-block__control--stack">
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

              <div class="setting-access__setting-block settings-block">
                <div class="setting-access__setting-copy settings-block__copy">
                  <strong>订阅源管理</strong>
                  <small>管理订阅源、推荐和抓取任务。</small>
                </div>
                <div class="setting-access__setting-control settings-block__control">
                  <PButton
                    data-test="subscription-management-detail-link"
                    to="/site/setting/subscriptions"
                    variant="secondary"
                    size="sm"
                  >
                    查看详情
                  </PButton>
                </div>
              </div>
            </div>

            <div v-else-if="key === 'music'" class="setting-access__module-body">
              <SettingMusicReviewPanel />
            </div>

            <div v-else-if="key === 'blog'" class="setting-access__module-body">
              <div class="setting-access__setting-block settings-block">
                <div class="setting-access__setting-copy settings-block__copy">
                  <strong>评论权限</strong>
                  <small>控制文章评论开放范围。</small>
                </div>
                <div class="setting-access__setting-control settings-block__control settings-block__control--stack">
                  <label v-for="mode in blogCommentModes" :key="mode.value" class="setting-access__radio-row">
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
              <label class="setting-access__setting-block settings-block">
                <div class="setting-access__setting-copy settings-block__copy">
                  <strong>申请分类</strong>
                  <small>控制普通用户是否可发起新分类申请。</small>
                </div>
                <div class="setting-access__setting-control settings-block__control">
                  <input v-model="draft.settings.forum.allow_category_request" type="checkbox" />
                </div>
              </label>

              <SettingForumModeratorPanel v-if="draft.modules.forum.enabled" />

              <PButton variant="secondary" to="/site/setting/community"> 社区管理 </PButton>
            </div>

            <div v-else class="setting-access__module-body">
              <div class="setting-access__setting-block settings-block">
                <div class="setting-access__setting-copy settings-block__copy">
                  <strong>{{ moduleRooms[key].name }}</strong>
                  <small>{{ moduleRooms[key].helper }}</small>
                </div>
                <div class="setting-access__setting-control settings-block__control">
                  <span class="setting-access__placeholder settings-placeholder">尚未开放</span>
                </div>
              </div>
            </div>
          </PSurface>
        </section>
    </div>

    <div class="setting-access__actions">
      <PButton variant="secondary" to="/">返回首页</PButton>
      <PButton :loading="saving" loading-text="保存中..." @click="save">保存设置</PButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import SettingForumModeratorPanel from '@/components/setting/SettingForumModeratorPanel.vue'
import SettingMusicReviewPanel from '@/components/setting/SettingMusicReviewPanel.vue'
import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import { moduleNavOrder, moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { mergeSiteAccess, type SiteAccess } from '@/config/siteAccess'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import {
  getSectionDomId,
  resolveActiveSectionByScroll,
  resolveInitialSettingSection
} from '@/views/setting/settingAccessSections'

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const route = useRoute()
const draft = ref<SiteAccess>(mergeSiteAccess(siteAccessStore.access))
const saving = ref(false)
const saved = ref(false)
const error = ref('')

const blogCommentModes = [
  {
    value: 'all',
    label: '全部可评论',
    description: '游客可匿名评论，已登录用户正常署名。'
  },
  {
    value: 'authenticated',
    label: '仅登录用户可评论',
    description: '保持当前默认行为。'
  },
  {
    value: 'disabled',
    label: '关闭评论',
    description: '全站文章评论入口关闭。'
  }
] as const

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
  scrollToRouteSection()
})

watch(() => route?.hash ?? window.location.hash, scrollToRouteSection)

function scrollToRouteSection() {
  nextTick(() => {
    const initialSection = resolveInitialSettingSection(route?.hash ?? window.location.hash)
    if (initialSection) {
      document.getElementById(getSectionDomId(initialSection))?.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  })
}
</script>

<style scoped>
.setting-access {
  gap: 1.5rem;
}

.setting-access__module-enabled input,
.setting-access__setting-block input,
.setting-access__radio-row input,
.setting-access__section-state input,
.setting-access__module-nav input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-text);
}

.setting-access__section-head h2,
.setting-access__section-head p,
.setting-access__placeholder,
.setting-access__module-helper,
.setting-access__message {
  margin: 0;
}

.setting-access__module-helper,
.setting-access__placeholder {
  color: var(--a-color-text-secondary);
  line-height: 1.6;
}

.setting-access__section-state {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  white-space: nowrap;
}

.setting-access__module-body {
  display: grid;
  gap: 1rem;
}

.setting-access__setting-copy strong,
.setting-access__setting-copy small,
.setting-access__radio-row strong,
.setting-access__radio-row small {
  display: block;
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
  color: var(--a-color-text);
  font-weight: var(--a-font-weight-strong);
}

.setting-access__message--error {
  color: var(--a-color-danger);
}

@media (max-width: 640px) {
  .setting-access__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
