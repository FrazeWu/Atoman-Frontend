<template>
  <svg
    :class="['oauth-brand-icon', `oauth-brand-icon--${props.provider}`]"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      v-for="path in icon.paths"
      :key="path.fill"
      :d="path.d"
      :fill="path.fill"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { siGithub } from 'simple-icons'

import type { OAuthProvider } from '@/services/oauth'

const props = defineProps<{ provider: OAuthProvider }>()
const providerIcons = {
  google: {
    paths: [
      {
        fill: '#4285F4',
        d: 'M21.56 12.23c0-.71-.06-1.4-.18-2.06H12v3.89h5.36a4.58 4.58 0 0 1-1.99 3.01v2.53h3.22c1.88-1.74 2.97-4.29 2.97-7.37Z',
      },
      {
        fill: '#34A853',
        d: 'M12 21.96c2.69 0 4.95-.89 6.59-2.36l-3.22-2.53c-.89.6-2.03.95-3.37.95-2.6 0-4.8-1.75-5.59-4.11H3.08v2.61A9.96 9.96 0 0 0 12 21.96Z',
      },
      {
        fill: '#FBBC05',
        d: 'M6.41 13.91A5.99 5.99 0 0 1 6.1 12c0-.66.11-1.31.31-1.91V7.48H3.08A9.96 9.96 0 0 0 2.04 12c0 1.61.38 3.13 1.04 4.52l3.33-2.61Z',
      },
      {
        fill: '#EA4335',
        d: 'M12 5.98c1.47 0 2.78.5 3.82 1.49l2.84-2.85C16.94 3.02 14.69 2.04 12 2.04a9.96 9.96 0 0 0-8.92 5.44l3.33 2.61C7.2 7.73 9.4 5.98 12 5.98Z',
      },
    ],
  },
  github: {
    paths: [{ d: siGithub.path, fill: 'currentColor' }],
  },
  microsoft: {
    paths: [
      { fill: '#F25022', d: 'M2 2h9.5v9.5H2z' },
      { fill: '#7FBA00', d: 'M12.5 2H22v9.5h-9.5z' },
      { fill: '#00A4EF', d: 'M2 12.5h9.5V22H2z' },
      { fill: '#FFB900', d: 'M12.5 12.5H22V22h-9.5z' },
    ],
  },
} satisfies Record<OAuthProvider, { paths: Array<{ d: string; fill: string }> }>

const icon = computed(() => providerIcons[props.provider])
</script>

<style scoped>
.oauth-brand-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.oauth-brand-icon--github {
  color: var(--a-color-text);
}
</style>
