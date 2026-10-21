<template>
  <div class="m-guest-card" data-testid="guest-card">
    <div class="m-guest-card__icon-box">
      <MIcon :name="icon" size="md" :stroke-width="1.8" />
    </div>

    <div class="m-guest-card__content">
      <h2 class="m-guest-card__title">{{ title }}</h2>
      <p class="m-guest-card__desc">{{ description }}</p>
    </div>

    <div class="m-guest-card__actions">
      <RouterLink :to="loginUrl" class="m-guest-card__login-link">
        <MButton variant="primary" block data-testid="guest-login-btn">
          {{ actionText }}
        </MButton>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    actionText?: string
    icon?: string
    loginRedirect?: string
  }>(),
  {
    title: '登录 Atoman 账号',
    description: '登录后可跨端同步你的收藏、创作草稿与足迹记录。',
    actionText: '立即登录',
    icon: 'person',
    loginRedirect: undefined,
  }
)

const route = useRoute()

const loginUrl = computed(() => {
  const redirect = props.loginRedirect || (route ? route.fullPath : '/')
  return `/login?redirect=${encodeURIComponent(redirect)}`
})
</script>

<style scoped>
.m-guest-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 20px 24px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  margin: 16px;
  box-sizing: border-box;
}

.m-guest-card__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background-color: #f8fafc;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text-primary, #0f172a);
  margin-bottom: 16px;
}

.m-guest-card__content {
  margin-bottom: 20px;
}

.m-guest-card__title {
  margin: 0 0 8px 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.m-guest-card__desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #64748b);
  max-width: 280px;
}

.m-guest-card__actions {
  width: 100%;
}

.m-guest-card__login-link {
  text-decoration: none;
  display: block;
  width: 100%;
}
</style>
