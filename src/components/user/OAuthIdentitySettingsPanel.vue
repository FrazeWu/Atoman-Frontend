<template>
  <section class="settings-block oauth-identities">
    <div class="settings-block__copy oauth-identities__copy">
      <strong>已连接账号</strong>
      <small>使用第三方账号登录 Atoman。</small>
    </div>
    <div class="settings-block__control settings-block__control--form oauth-identities__control">
      <p v-if="loading" class="oauth-identities__status" role="status">加载中...</p>
      <p v-else-if="error" class="oauth-identities__error" role="alert">{{ error }}</p>
      <ul v-else class="oauth-identities__list">
      <li
        v-for="provider in providers"
        :key="provider"
        :data-test="`oauth-identity-${provider}`"
      >
        <div class="oauth-identities__provider">
          <OAuthBrandIcon :provider="provider" />
          <div>
            <strong>{{ oauthProviderLabels[provider] }}</strong>
            <small>{{ identityFor(provider)?.email || '未绑定' }}</small>
          </div>
        </div>
        <PButton
          v-if="identityFor(provider)"
          :data-test="`oauth-unlink-${provider}`"
          type="button"
          variant="danger"
          size="md"
          @click="pendingUnlink = provider"
        >
          取消绑定
        </PButton>
        <PButton
          v-else
          :data-test="`oauth-link-${provider}`"
          :href="oauthStartURL(provider, { purpose: 'link', returnTo })"
          variant="secondary"
          size="md"
        >
          绑定
        </PButton>
      </li>
      </ul>
    </div>

    <PConfirm
      :show="pendingUnlink !== null"
      title="取消绑定"
      :message="pendingUnlink ? `确定取消绑定 ${oauthProviderLabels[pendingUnlink]} 吗？` : ''"
      confirm-text="取消绑定"
      danger
      side="right"
      :loading="unlinking"
      :error="unlinkError"
      @confirm="confirmUnlink"
      @cancel="cancelUnlink"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import OAuthBrandIcon from '@/components/auth/OAuthBrandIcon.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { errorMessage } from '@/utils/logger'
import {
  listOAuthIdentities,
  listOAuthProviders,
  oauthProviderLabels,
  oauthStartURL,
  unlinkOAuthIdentity,
  type OAuthIdentity,
  type OAuthProvider,
} from '@/services/oauth'

const props = withDefaults(defineProps<{ returnTo?: string }>(), { returnTo: '/' })
const providers = ref<OAuthProvider[]>([])
const identities = ref<OAuthIdentity[]>([])
const loading = ref(true)
const error = ref('')
const pendingUnlink = ref<OAuthProvider | null>(null)
const unlinking = ref(false)
const unlinkError = ref('')

function identityFor(provider: OAuthProvider) {
  return identities.value.find(identity => identity.provider === provider)
}

onMounted(async () => {
  try {
    [providers.value, identities.value] = await Promise.all([
      listOAuthProviders(),
      listOAuthIdentities(),
    ])
  } catch (cause) {
    error.value = errorMessage(cause, '无法加载登录方式')
  } finally {
    loading.value = false
  }
})

async function confirmUnlink() {
  if (!pendingUnlink.value) return
  const provider = pendingUnlink.value
  unlinking.value = true
  unlinkError.value = ''
  try {
    await unlinkOAuthIdentity(provider)
    identities.value = identities.value.filter(identity => identity.provider !== provider)
    pendingUnlink.value = null
  } catch (cause) {
    unlinkError.value = errorMessage(cause, '无法取消绑定')
  } finally {
    unlinking.value = false
  }
}

function cancelUnlink() {
  if (unlinking.value) return
  pendingUnlink.value = null
  unlinkError.value = ''
}
</script>

<style scoped>
.oauth-identities {
  min-width: 0;
}

.oauth-identities__list li,
.oauth-identities__provider {
  display: flex;
  align-items: center;
}

.oauth-identities__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.oauth-identities__list li {
  min-height: 64px;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.oauth-identities__provider {
  min-width: 0;
  gap: 0.75rem;
}

.oauth-identities__provider div {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.oauth-identities__provider small,
.oauth-identities__status {
  color: var(--a-color-muted);
}

.oauth-identities__provider small {
  overflow-wrap: anywhere;
}

.oauth-identities__status,
.oauth-identities__error {
  margin: 0;
  line-height: 1.5;
}

.oauth-identities__error {
  color: var(--a-color-danger);
}

@media (max-width: 520px) {
  .oauth-identities__list li {
    align-items: flex-start;
    flex-direction: column;
    padding: 0.875rem 0;
  }

  .oauth-identities__list :deep(.p-button) {
    width: 100%;
  }
}
</style>
