<template>
  <div v-if="providers.length" class="oauth-providers">
    <div
      data-test="oauth-provider-list"
      class="oauth-providers__grid"
      role="group"
      aria-label="第三方登录"
    >
      <PButton
        v-for="provider in providers"
        :key="provider"
        :data-test="`oauth-provider-${provider}`"
        :href="oauthStartURL(provider, { purpose, returnTo })"
        :aria-label="`使用 ${oauthProviderLabels[provider]} 继续`"
        variant="secondary"
        size="lg"
        block
      >
        <OAuthBrandIcon :provider="provider" />
        <span>{{ oauthProviderLabels[provider] }}</span>
      </PButton>
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

onMounted(async () => {
  try {
    providers.value = await listOAuthProviders()
  } catch {
    providers.value = []
  }
})
</script>

<style scoped>
.oauth-providers {
  display: grid;
  gap: 1rem;
}

.oauth-providers__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

.oauth-providers__grid :deep(.p-button) {
  min-width: 0;
  padding-inline: 1rem;
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

@media (max-width: 440px) {
  .oauth-providers__grid {
    grid-template-columns: 1fr;
  }
}
</style>
