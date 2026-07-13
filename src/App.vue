<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div :class="['app-shell', { 'has-sidebar': hasSidebar }]">
      <AppTopbar />
      <main :class="[
        'app-main', 
        { 'app-main--auth': isAuthRoute },
        { 'shutter-exit': transition.isExiting },
        { 'shutter-entry': transition.isEntering }
      ]">
        <router-view />
      </main>
      <BlogSheetStack />
      <MobileBottomNav v-if="showMobileBottomNav" />
      <SiteFooter v-if="!hasSidebar" />
      <AudioPlayer v-if="hasActiveTrack" />
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { useRoute } from 'vue-router'
import AppTopbar from '@/components/system/AppTopbar.vue'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import SiteFooter from '@/components/system/SiteFooter.vue'
import { usePlayerStore } from '@/stores/player'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useTransitionStore } from '@/stores/transition'
import { useTransitionRelay } from '@/composables/useTransitionRelay'

const AudioPlayer = defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))
const BlogSheetStack = defineAsyncComponent(() => import('@/components/blog/BlogSheetStack.vue'))

const themeOverrides = {
  common: {
    primaryColor: '#000000',
    primaryColorHover: '#333333',
    primaryColorPressed: '#000000',
    borderRadius: '0px',
  },
}

const route = useRoute()
const player = usePlayerStore()
const siteAccessStore = useSiteAccessStore()
const transition = useTransitionStore()
const { checkRelay } = useTransitionRelay()

const hasSidebar = computed(() => route.matched.some((record) => record.meta.hasSidebar))
const isAuthRoute = computed(() => route.matched.some((record) => record.meta.authLayout))
const hasActiveTrack = computed(() => Boolean(player.currentSong))
const showMobileBottomNav = computed(() => hasSidebar.value && !isAuthRoute.value)

onMounted(() => {
  if (localStorage.getItem('atoman_transition_relay')) {
    transition.triggerEntry()
    checkRelay()
  } else if (localStorage.getItem('atoman_transition_relay_basic')) {
    transition.triggerEntry()
    localStorage.removeItem('atoman_transition_relay_basic')
  }
  siteAccessStore.load()
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.app-main {
  flex: 1;
  padding-bottom: 128px;
  background: #fff;
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.app-shell.has-sidebar .app-main {
  padding-bottom: 0;
}

/* 出场：内容区原地渐隐 */
.shutter-exit {
  opacity: 0;
  filter: blur(4px);
  pointer-events: none;
}

/* 入场关键帧：内容区原地渐出 */
@keyframes shutterIn {
  from {
    opacity: 0;
    filter: blur(4px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

.shutter-entry {
  animation: shutterIn 0.7s ease-out forwards;
}

.app-main--auth {
  padding-bottom: 0;
  background: #fff;
}
</style>
