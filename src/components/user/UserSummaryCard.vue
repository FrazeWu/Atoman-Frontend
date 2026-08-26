<template>
  <component
    :is="rootComponent"
    v-bind="rootProps"
    class="user-summary-card"
    :class="{ 'user-summary-card--compact': compact, 'user-summary-card--metrics-only': !showIdentity }"
    :aria-label="showIdentity ? `${displayName} 的用户摘要` : '用户信誉与贡献'"
  >
    <PAvatar
      v-if="showIdentity"
      :src="user.avatar_url"
      :name="displayName"
      :size="avatarSize"
      :alt="`${displayName}的头像`"
    />
    <div v-if="showIdentity" class="user-summary-card__identity">
      <strong class="user-summary-card__name">{{ displayName }}</strong>
      <span class="user-summary-card__handle">@{{ user.username }}</span>
    </div>
    <div class="user-summary-card__metrics" aria-label="信誉与贡献">
      <span class="user-summary-card__metric user-summary-card__metric--quality">
        <span>信誉分</span>
        <strong>{{ qualityText }}</strong>
      </span>
      <span class="user-summary-card__metric user-summary-card__metric--contribution">
        <span>贡献分</span>
        <strong>{{ contributionText }}</strong>
      </span>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import PAvatar from '@/components/ui/PAvatar.vue'
import { userUrl } from '@/composables/useSubdomainNav'

interface SummaryUser {
  username: string
  display_name?: string
  avatar_url?: string
  quality?: number | null
  contribution_total?: number | null
}

const props = withDefaults(defineProps<{
  user: SummaryUser
  compact?: boolean
  exactContribution?: boolean
  link?: boolean
  showIdentity?: boolean
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  compact: false,
  exactContribution: false,
  link: false,
  showIdentity: true,
  avatarSize: 'sm',
})

const displayName = computed(() => props.user.display_name || props.user.username)
const qualityText = computed(() => formatQuality(props.user.quality ?? 20))
const contributionText = computed(() => formatContribution(props.user.contribution_total ?? 0, props.exactContribution))
const profileHref = computed(() => props.user.username ? userUrl(props.user.username) : '')
const rootComponent = computed(() => props.link && profileHref.value ? RouterLink : 'div')
const rootProps = computed(() => props.link && profileHref.value ? { to: profileHref.value } : {})

function formatQuality(value: number) {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : 20
  return (Math.round((normalized + Number.EPSILON) * 10) / 10).toFixed(1)
}

function formatContribution(value: number, exact: boolean) {
  const normalized = Math.max(0, Math.floor(Number(value) || 0))
  if (exact || normalized <= 100) return new Intl.NumberFormat('zh-CN').format(normalized)
  if (normalized < 1000) return '100+'
  if (normalized < 2000) return '1k+'
  if (normalized < 10000) return `${Math.floor(normalized / 1000)}k+`
  return `${Math.floor(normalized / 10000)}w+`
}
</script>

<style scoped>
.user-summary-card {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}
.user-summary-card--compact { gap: 0.4rem; }
.user-summary-card--metrics-only { gap: 0; }
.user-summary-card__identity {
  display: grid;
  min-width: 0;
  gap: 0.08rem;
}
.user-summary-card__name {
  overflow: hidden;
  color: var(--a-color-text);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-summary-card__handle {
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-summary-card__metrics {
  display: grid;
  flex: 0 0 auto;
  gap: 0.05rem;
  margin-left: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.68rem;
  line-height: 1.05;
  white-space: nowrap;
}
.user-summary-card__metric {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
}
.user-summary-card__metric strong {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.user-summary-card__metric--quality strong {
  color: #b45309;
}
.user-summary-card__metric--contribution strong {
  color: var(--a-color-text-secondary);
}
.user-summary-card--compact .user-summary-card__metrics {
  font-size: 0.64rem;
}
.user-summary-card__metrics-only .user-summary-card__metrics {
  margin-left: 0;
}
.user-summary-card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 3px;
}
</style>
