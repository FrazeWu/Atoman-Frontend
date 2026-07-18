<template>
  <div class="user-blog-settings-panel">
    <div class="settings-block">
      <div class="settings-block__copy">
        <strong>资料预览</strong>
        <small>保存后会显示在主页。</small>
      </div>
      <div class="settings-block__control user-blog-settings-panel__identity">
      <div style="width:5rem;height:5rem;border-radius:var(--a-radius-none);background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.875rem;font-weight:900;flex-shrink:0;overflow:hidden">
        <img v-if="form.avatar_url" :src="form.avatar_url" alt="avatar" style="width:100%;height:100%;object-fit:cover" />
        <span v-else>{{ (form.display_name || authStore.user?.username || '?').charAt(0).toUpperCase() }}</span>
      </div>
      <div>
        <p style="font-weight:900;font-size:1.125rem">{{ form.display_name || authStore.user?.username }}</p>
        <p class="a-muted" style="font-size:.875rem">@{{ authStore.user?.username }}</p>
      </div>
      </div>
    </div>

    <form class="user-blog-settings-panel__form" @submit.prevent="save">
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">显示名称</label>
        <input v-model="form.display_name" placeholder="用于展示的名称" class="a-input" />
      </div>
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">个人简介</label>
        <textarea v-model="form.bio" placeholder="介绍一下自己..." rows="4" class="a-textarea" />
      </div>
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">个人网站</label>
        <input v-model="form.website" placeholder="https://yoursite.com" type="url" class="a-input" />
      </div>
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">所在地</label>
        <input v-model="form.location" placeholder="城市或地区" class="a-input" />
      </div>
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">头像 URL</label>
        <input v-model="form.avatar_url" placeholder="https://example.com/avatar.jpg" class="a-input" />
      </div>
      <div class="a-field user-blog-settings-panel__field">
        <label class="a-field-label">私信权限</label>
        <PSelect v-model="form.dm_permission" :options="dmPermissionOptions" />
      </div>

      <section v-if="includeAccountExtras" class="settings-section">
        <h2 class="a-subtitle">通知设置</h2>
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
        <p class="a-muted">私信、@我、账号安全和关键权限变化始终提醒。</p>
      </section>

      <section v-if="includeAccountExtras" class="settings-section">
        <h2 class="a-subtitle">已拉黑用户</h2>
        <div v-if="userBlocksStore.blockedUsers.length === 0" class="a-muted">暂无拉黑用户</div>
        <div v-for="item in userBlocksStore.blockedUsers" :key="item.id" class="blocked-user-row">
          <span>{{ item.blocked?.display_name || item.blocked?.username || item.blocked_id }}</span>
          <PButton variant="secondary" type="button" @click="userBlocksStore.unblockUser(item.blocked_id)">取消拉黑</PButton>
        </div>
      </section>

      <div class="user-blog-settings-panel__password">
        <h2 class="a-subtitle" style="margin-bottom:1rem">修改密码</h2>
        <div style="display:flex;flex-direction:column;gap:1rem">
          <div class="a-field">
            <label class="a-field-label">新密码</label>
            <input v-model="newPassword" type="password" placeholder="留空表示不修改" class="a-input" />
          </div>
          <div class="a-field">
            <label class="a-field-label">确认新密码</label>
            <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" class="a-input" />
          </div>
        </div>
      </div>

      <div v-if="error" class="a-error">{{ error }}</div>
      <div v-if="success" class="a-success">✓ 保存成功</div>

      <PButton block type="submit" :loading="saving" loadingText="保存中...">保存更改</PButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useUserBlocksStore } from '@/stores/userBlocks'
import type { DMPermission } from '@/types'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const userBlocksStore = useUserBlocksStore()
const api = useApi()

withDefaults(defineProps<{
  includeAccountExtras?: boolean
}>(), {
  includeAccountExtras: true,
})

const dmPermissionOptions = [
  { label: '任意人可私信', value: 'anyone' },
  { label: '仅我关注的人', value: 'following_only' },
  { label: '陌生人仅可发一条', value: 'one_before_reply' },
]

const form = ref({
  display_name: '',
  bio: '',
  website: '',
  location: '',
  avatar_url: '',
  dm_permission: 'one_before_reply' as DMPermission,
})
const notificationPrefs = ref({
  like: true,
  interaction: true,
  reply: true,
  collaboration: true,
})

const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const error = ref('')
const success = ref(false)

const loadProfile = async () => {
  try {
    const res = await fetch(api.users.me, {
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
        dm_permission: 'one_before_reply',
      }

      const settingsRes = await fetch(api.users.meSettings, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        form.value.dm_permission = settingsData.data?.dm_permission || 'one_before_reply'
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const save = async () => {
  error.value = ''
  success.value = false

  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  saving.value = true
  try {
    await notificationStore.savePreferences([
      { category: 'like', event_type: 'content.liked', enabled: notificationPrefs.value.like },
      { category: 'interaction', event_type: 'content.bookmarked', enabled: notificationPrefs.value.interaction },
      { category: 'reply', event_type: 'content.replied', enabled: notificationPrefs.value.reply },
      { category: 'collaboration', event_type: 'collaboration.changed', enabled: notificationPrefs.value.collaboration },
    ])

    const payload: Record<string, string> = { ...form.value }
    if (newPassword.value) payload.password = newPassword.value

    await fetch(api.users.meSettings, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ dm_permission: form.value.dm_permission }),
    })

    const res = await fetch(api.users.settings, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const d = await res.json()
      const updated = d.data || d
      if (authStore.user) {
        authStore.user.display_name = updated.display_name
        authStore.user.avatar_url = updated.avatar_url
        authStore.user.bio = updated.bio
        localStorage.setItem('user', JSON.stringify(authStore.user))
      }
      newPassword.value = ''
      confirmPassword.value = ''
      success.value = true
      setTimeout(() => { success.value = false }, 3000)
    } else {
      const err = await res.json()
      error.value = err.error || '保存失败'
    }
  } catch (e) {
    error.value = '网络错误，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadProfile(),
    userBlocksStore.fetchBlockedUsers(),
  ])
})
</script>

<style scoped>
.user-blog-settings-panel {
  display: grid;
  gap: 1rem;
}

.user-blog-settings-panel__identity {
  justify-content: flex-start;
  gap: 1rem;
}

.user-blog-settings-panel__form {
  display: grid;
  gap: 0;
}

.user-blog-settings-panel__field,
.user-blog-settings-panel__password {
  padding: 1rem 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.user-blog-settings-panel__password {
  display: grid;
  gap: 1rem;
}

.settings-section {
  border-top: 1.5px solid var(--a-color-border-soft);
  padding-top: 1.25rem;
}

.settings-toggle,
.blocked-user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
}
</style>
