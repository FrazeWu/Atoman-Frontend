<template>
  <button
    type="button"
    class="mobile-module-switcher"
    data-testid="mobile-module-switcher"
    aria-haspopup="dialog"
    :aria-expanded="show"
    @click="show = true"
  >
    <span class="mobile-module-switcher__label">{{ label }}</span>
    <ChevronDown :size="16" aria-hidden="true" />
  </button>

  <PSheet
    :show="show"
    side="bottom"
    title="切换模块"
    close-type="header"
    @close="show = false"
  >
    <div class="mobile-module-sheet" data-testid="mobile-module-sheet">
      <section class="mobile-module-sheet__section">
        <p class="mobile-module-sheet__eyebrow">模块</p>
        <nav class="mobile-module-sheet__grid" aria-label="切换模块">
          <a
            v-for="item in items"
            :key="item.module"
            :href="item.href"
            class="mobile-module-sheet__item"
            :class="{ 'is-current': item.module === currentModule }"
            @click.prevent="openModule(item.href)"
          >
            <component :is="item.icon" :size="18" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </a>
        </nav>
      </section>

      <section class="mobile-module-sheet__section mobile-module-sheet__section--bordered">
        <p class="mobile-module-sheet__eyebrow">个人</p>
        <nav class="mobile-module-sheet__account" aria-label="个人入口">
          <component
            v-if="authStore.user"
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :to="props.desktopBaseUrl ? undefined : `/users/${authStore.user.username}`"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <UserRound :size="18" aria-hidden="true" />
            <span>个人资料</span>
          </component>
          <component
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :href="desktopHref('/inbox?tab=notifications')"
            :to="props.desktopBaseUrl ? undefined : '/inbox?tab=notifications'"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <Bell :size="18" aria-hidden="true" />
            <span>通知</span>
          </component>
          <component
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :href="desktopHref('/inbox?tab=dm')"
            :to="props.desktopBaseUrl ? undefined : '/inbox?tab=dm'"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <MessageCircle :size="18" aria-hidden="true" />
            <span>私信</span>
          </component>
          <component
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :href="desktopHref('/studio')"
            :to="props.desktopBaseUrl ? undefined : '/studio'"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <PenLine :size="18" aria-hidden="true" />
            <span>Studio</span>
          </component>
          <component
            v-if="authStore.user"
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :href="desktopHref(`/users/${authStore.user.username}/settings`)"
            :to="props.desktopBaseUrl ? undefined : `/users/${authStore.user.username}/settings`"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <Settings :size="18" aria-hidden="true" />
            <span>设置</span>
          </component>
          <component
            v-else
            :is="props.desktopBaseUrl ? 'a' : RouterLink"
            :href="desktopHref('/login')"
            :to="props.desktopBaseUrl ? undefined : '/login'"
            class="mobile-module-sheet__account-link"
            @click="show = false"
          >
            <LogIn :size="18" aria-hidden="true" />
            <span>登录</span>
          </component>
        </nav>
      </section>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Bell, ChevronDown, LogIn, MessageCircle, PenLine, Settings, UserRound } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import { getMobileMoreItems } from '@/composables/useResponsiveShell'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'

const props = withDefaults(defineProps<{
  label: string
  currentModule?: ModuleRoomKey | null
  availableModules?: ModuleRoomKey[]
  desktopBaseUrl?: string
}>(), {
  currentModule: null,
  availableModules: undefined,
  desktopBaseUrl: '',
})

const show = ref(false)
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const { navigateModuleWithShutter } = useAsyncNavigate()
const items = computed(() => getMobileMoreItems().filter(item => (
  siteAccessStore.isModuleVisible(item.module)
  && (!props.availableModules || props.availableModules.includes(item.module))
)))

function desktopHref(path: string) {
  if (!props.desktopBaseUrl) return undefined
  return `${props.desktopBaseUrl.replace(/\/$/, '')}${path}`
}

async function openModule(href: string) {
  show.value = false
  await navigateModuleWithShutter(href)
}
</script>

<style scoped>
.mobile-module-switcher {
  display: none;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
}

.mobile-module-switcher__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-module-sheet {
  display: grid;
  gap: 1.25rem;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-module-sheet__section {
  display: grid;
  gap: 0.75rem;
}

.mobile-module-sheet__section--bordered {
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.mobile-module-sheet__eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.mobile-module-sheet__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.mobile-module-sheet__item,
.mobile-module-sheet__account-link {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
}

.mobile-module-sheet__item.is-current {
  border-color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.mobile-module-sheet__account {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.mobile-module-sheet__account-link {
  justify-content: flex-start;
  font-size: 0.875rem;
}

.mobile-module-sheet__item:hover,
.mobile-module-sheet__item:focus-visible,
.mobile-module-sheet__account-link:hover,
.mobile-module-sheet__account-link:focus-visible {
  border-color: var(--a-color-fg);
  text-decoration: none;
}

@media (max-width: 720px) {
  .mobile-module-switcher {
    display: inline-flex;
    flex: 1;
  }
}
</style>
