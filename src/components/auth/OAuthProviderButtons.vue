<template>
  <div v-if="providers.length" class="oauth-providers">
    <div
      data-test="oauth-provider-list"
      :class="['oauth-providers__grid', `oauth-providers__grid--${providers.length}`]"
      role="group"
      aria-label="第三方登录"
    >
      <div
        v-for="provider in providers"
        :key="provider"
        class="oauth-providers__item"
        :data-test="`oauth-provider-item-${provider}`"
      >
        <span
          v-if="lastUsedProvider === provider"
          data-test="oauth-provider-last-used"
          class="oauth-providers__last-used"
          aria-hidden="true"
        >最近使用</span>
        <PButton
          :data-test="`oauth-provider-${provider}`"
          :href="oauthStartURL(provider, { purpose, returnTo })"
          :aria-label="`使用 ${oauthProviderLabels[provider]} 继续${lastUsedProvider === provider ? '，最近使用' : ''}`"
          variant="secondary"
          size="lg"
          block
          @click="rememberProvider(provider)"
        >
          <OAuthBrandIcon :provider="provider" />
          <span>{{ oauthProviderLabels[provider] }}</span>
        </PButton>
      </div>
    </div>
    <div class="oauth-providers__divider" aria-hidden="true"><span>或</span></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import OAuthBrandIcon from '@/components/auth/OAuthBrandIcon.vue'
import PButton from '@/components/ui/PButton.vue'
import {
  listOAuthProviders,
  oauthProviders,
  oauthProviderLabels,
  oauthStartURL,
  type OAuthProvider,
  type OAuthPurpose,
} from '@/services/oauth'

const props = withDefaults(defineProps<{
  purpose?: OAuthPurpose
  returnTo?: string
}>(), {
  purpose: 'login',
  returnTo: '/',
})

const providers = ref<OAuthProvider[]>([])
const lastUsedProvider = ref<OAuthProvider | null>(null)
const lastUsedProviderKey = 'atoman_oauth_last_provider'

function readLastUsedProvider() {
  try {
    const storedProvider = localStorage.getItem(lastUsedProviderKey)
    return oauthProviders.includes(storedProvider as OAuthProvider)
      ? storedProvider as OAuthProvider
      : null
  } catch {
    return null
  }
}

function rememberProvider(provider: OAuthProvider) {
  lastUsedProvider.value = provider
  try {
    localStorage.setItem(lastUsedProviderKey, provider)
  } catch {
    // Login must remain available when browser storage is disabled.
  }
}

onMounted(async () => {
  lastUsedProvider.value = readLastUsedProvider()
  try {
    const configuredProviders = await listOAuthProviders()
    providers.value = oauthProviders.filter(provider => configuredProviders.includes(provider))
  } catch {
    providers.value = []
  }
})
</script>

<style scoped>
.oauth-providers {
  display: grid;
  gap: 1rem;
  container-type: inline-size;
}

.oauth-providers__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding-top: 0.625rem;
}

.oauth-providers__grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.oauth-providers__grid--1 {
  grid-template-columns: 1fr;
}

.oauth-providers__item {
  position: relative;
  min-width: 0;
}

.oauth-providers__item :deep(.p-button) {
  width: 100%;
  min-width: 0;
  min-height: 3rem;
  gap: 0.375rem;
  padding-inline: 0.5rem;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.oauth-providers__last-used {
  position: absolute;
  z-index: 1;
  top: -0.625rem;
  left: 50%;
  padding: 0.125rem 0.5rem;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.25rem;
  white-space: nowrap;
  pointer-events: none;
}

.oauth-providers__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.oauth-providers__divider::before,
.oauth-providers__divider::after {
  height: 1px;
  background: var(--a-color-border-soft);
  content: '';
}

@container (max-width: 17rem) {
  .oauth-providers__grid {
    grid-template-columns: 1fr;
  }

  .oauth-providers__item :deep(.p-button) {
    padding-inline: 1rem;
    font-size: 0.875rem;
  }
}
</style>
