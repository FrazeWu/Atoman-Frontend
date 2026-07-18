<template>
  <svg
    class="oauth-brand-icon"
    :style="{ color: `#${icon.hex}` }"
    :viewBox="icon.viewBox"
    aria-hidden="true"
  >
    <path :d="icon.path" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { faMicrosoft } from '@fortawesome/free-brands-svg-icons'
import { siApple, siGithub, siGoogle } from 'simple-icons'

import type { OAuthProvider } from '@/services/oauth'

const props = defineProps<{ provider: OAuthProvider }>()
const providerIcons = {
  google: { path: siGoogle.path, hex: siGoogle.hex, viewBox: '0 0 24 24' },
  apple: { path: siApple.path, hex: siApple.hex, viewBox: '0 0 24 24' },
  github: { path: siGithub.path, hex: siGithub.hex, viewBox: '0 0 24 24' },
  microsoft: {
    path: faMicrosoft.icon[4] as string,
    hex: '5E5E5E',
    viewBox: `0 0 ${faMicrosoft.icon[0]} ${faMicrosoft.icon[1]}`,
  },
} satisfies Record<OAuthProvider, { path: string; hex: string; viewBox: string }>

const icon = computed(() => providerIcons[props.provider])
</script>

<style scoped>
.oauth-brand-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}
</style>
