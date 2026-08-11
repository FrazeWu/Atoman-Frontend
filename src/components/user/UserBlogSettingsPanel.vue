<template>
  <div class="user-blog-settings-panel">
    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>资料预览</strong>
        <small>个人主页和公开名片上显示的完整资料。</small>
      </div>
      <div class="settings-block__control user-blog-settings-panel__identity">
        <div class="avatar-preview-box">
          <img v-if="form.avatar_url" :src="form.avatar_url" alt="avatar" />
          <span v-else>{{ (form.display_name || authStore.user?.username || '?').charAt(0).toUpperCase() }}</span>
        </div>
        <div class="identity-info">
          <strong>{{ form.display_name || authStore.user?.username }}</strong>
          <small class="a-muted">@{{ authStore.user?.username }}</small>
        </div>
      </div>
    </div>

    <form class="user-blog-settings-panel__form" @submit.prevent="save">
      <div class="form-grid">
        <PInput
          v-model="form.display_name"
          label="显示名称"
          placeholder="用于展示的名称"
        />
        <PInput
          v-model="form.avatar_url"
          label="头像 URL"
          placeholder="https://example.com/avatar.jpg"
        />
        <PInput
          v-model="form.website"
          label="个人网站"
          type="url"
          placeholder="https://yoursite.com"
        />
        <PInput
          v-model="form.location"
          label="所在地"
          placeholder="城市或地区"
        />
        <div class="form-field-full">
          <PTextarea
            v-model="form.bio"
            label="个人简介"
            placeholder="介绍一下自己..."
            :rows="3"
          />
        </div>
      </div>

      <section v-if="includeAccountExtras" class="settings-section">
        <h3 class="section-title">通知设置</h3>
        <div class="toggles-grid">
          <label class="settings-toggle">
            <input v-model="notificationPrefs.like" type="checkbox" />
            <span>点赞提醒</span>
          </label>
          <label class="settings-toggle">
            <input v-model="notificationPrefs.interaction" type="checkbox" />
            <span>互动提醒</span>
          </label>
          <label class="settings-toggle">
            <input v-model="notificationPrefs.reply" type="checkbox" />
            <span>回复提醒</span>
          </label>
          <label class="settings-toggle">
            <input v-model="notificationPrefs.collaboration" type="checkbox" />
            <span>协作提醒</span>
          </label>
        </div>
        <small class="a-muted">私信、@我、账号安全和关键权限变化始终提醒。</small>
      </section>

      <section v-if="includeAccountExtras" class="settings-section">
        <h3 class="section-title">已拉黑用户</h3>
        <div v-if="userBlocksStore.blockedUsers.length === 0" class="a-muted text-sm">暂无拉黑用户</div>
        <div v-for="item in userBlocksStore.blockedUsers" :key="item.id" class="blocked-user-row">
          <span>{{ item.blocked?.display_name || item.blocked?.username || item.blocked_id }}</span>
          <PButton variant="secondary" size="sm" type="button" @click="userBlocksStore.unblockUser(item.blocked_id)">取消拉黑</PButton>
        </div>
      </section>

      <div class="form-submit-row">
        <div v-if="error" class="a-error">{{ error }}</div>
        <div v-if="success" class="a-success">✓ 更改保存成功</div>

        <PButton variant="primary" type="submit" :loading="saving" loading-text="保存中...">保存更改</PButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequest } from '@/api/client'
import { onMounted, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useUserBlocksStore } from '@/stores/userBlocks'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const userBlocksStore = useUserBlocksStore()
const api = useApi()

withDefaults(defineProps<{
  includeAccountExtras?: boolean
}>(), {
  includeAccountExtras: true,
})

const form = ref({
  display_name: '',
  bio: '',
  website: '',
  location: '',
  avatar_url: '',
})
const notificationPrefs = ref({
  like: true,
  interaction: true,
  reply: true,
  collaboration: true,
})
const notificationTypes = {
  like: ['comment_like', 'forum_like'],
  interaction: ['comment_marked', 'forum_follow', 'forum_solved'],
  reply: ['comment_reply', 'forum_reply', 'forum_topic_comment'],
  collaboration: ['collaboration.required'],
} as const

const saving = ref(false)
const error = ref('')
const success = ref(false)

const loadProfile = async () => {
  try {
    const res = await apiRequest(api.users.me, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) {
      const d = await res.json()
      const u = d.data || d
      form.value = {
        display_name: u.display_name || '',
        bio: u.bio || '',
        website: u.website || '',
        location: u.location || '',
        avatar_url: u.avatar_url || '',
      }
    }
  } catch (e) {
    reportError(e)
  }
}

const loadNotificationPreferences = async () => {
  const items = await notificationStore.fetchPreferences()
  const byType = new Map(items.map((item) => [item.event_type, item.enabled]))
  for (const [category, eventTypes] of Object.entries(notificationTypes)) {
    notificationPrefs.value[category as keyof typeof notificationTypes] = eventTypes.every((eventType) => byType.get(eventType) !== false)
  }
}

const save = async () => {
  error.value = ''
  success.value = false

  saving.value = true
  try {
    const preferencesSaved = await notificationStore.savePreferences(Object.entries(notificationTypes).flatMap(([category, eventTypes]) =>
      eventTypes.map((eventType) => ({
        category: category as keyof typeof notificationTypes,
        event_type: eventType,
        enabled: notificationPrefs.value[category as keyof typeof notificationTypes],
      })),
    ))
    if (!preferencesSaved) throw new Error('通知设置保存失败')

    const res = await apiRequest(api.users.settings, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(form.value),
    })
    if (!res.ok) throw new Error('资料保存失败')
    const d = await res.json()
    const updated = d.data || d
    if (authStore.user) {
      authStore.updateUser({
        display_name: updated.display_name,
        avatar_url: updated.avatar_url,
        bio: updated.bio,
      })
    }
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '网络错误，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    loadNotificationPreferences(),
    userBlocksStore.fetchBlockedUsers(),
  ])
})
</script>

<style scoped>
.user-blog-settings-panel {
  display: grid;
  gap: 1.25rem;
}

.user-blog-settings-panel__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: flex-start;
}

.avatar-preview-box {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 6px;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.identity-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.identity-info strong {
  font-size: 1.05rem;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-field-full {
  grid-column: 1 / -1;
}

.settings-section {
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 1rem;
  margin-top: 0.5rem;
  display: grid;
  gap: 0.75rem;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.toggles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.75rem;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.blocked-user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
}

.form-submit-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
