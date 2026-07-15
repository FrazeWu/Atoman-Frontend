<template>
  <div class="a-page-sm" style="padding-bottom:12rem">
    <div class="a-section-header" style="margin-bottom:2.5rem">
      <h1 class="a-title a-accent-l">编辑资料</h1>
      <a :href="userUrl(authStore.user?.username || '')" class="a-link">← 我的主页</a>
    </div>

    <!-- Avatar preview -->
    <div class="a-card" style="display:flex;align-items:center;gap:1.5rem;margin-bottom:2rem">
      <div style="width:5rem;height:5rem;border-radius:var(--a-radius-none);background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.875rem;font-weight:900;flex-shrink:0;overflow:hidden">
        <img v-if="form.avatar_url" :src="form.avatar_url" alt="avatar" style="width:100%;height:100%;object-fit:cover" />
        <span v-else>{{ (form.display_name || authStore.user?.username || '?').charAt(0).toUpperCase() }}</span>
      </div>
      <div>
        <p style="font-weight:900;font-size:1.125rem">{{ form.display_name || authStore.user?.username }}</p>
        <p class="a-muted" style="font-size:.875rem">@{{ authStore.user?.username }}</p>
      </div>
    </div>

    <form @submit.prevent="save" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-field">
        <label class="a-field-label">显示名称</label>
        <input v-model="form.display_name" placeholder="用于展示的名称" class="a-input" />
      </div>
      <div class="a-field">
        <label class="a-field-label">个人简介</label>
        <textarea v-model="form.bio" placeholder="介绍一下自己..." rows="4" class="a-textarea" />
      </div>
      <div class="a-field">
        <label class="a-field-label">个人网站</label>
        <input v-model="form.website" placeholder="https://yoursite.com" type="url" class="a-input" />
      </div>
      <div class="a-field">
        <label class="a-field-label">所在地</label>
        <input v-model="form.location" placeholder="城市或地区" class="a-input" />
      </div>
      <div class="a-field">
        <label class="a-field-label">头像 URL</label>
        <input v-model="form.avatar_url" placeholder="https://example.com/avatar.jpg" class="a-input" />
      </div>
      <div class="a-field">
        <label class="a-field-label">私信权限</label>
        <PSelect v-model="form.dm_permission" :options="dmPermissionOptions" />
      </div>

      <div v-if="error" class="a-error">{{ error }}</div>
      <div v-if="success" class="a-success">✓ 保存成功</div>

      <PButton block type="submit" :loading="saving" loadingText="保存中...">保存更改</PButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { userUrl } from '@/composables/useSubdomainNav'
import { useApi } from '@/composables/useApi'
import type { DMPermission } from '@/types'

const authStore = useAuthStore()
const api = useApi()

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
  dm_permission: 'anyone' as DMPermission,
})

const saving = ref(false)
const error = ref('')
const success = ref(false)

const loadProfile = async () => {
  try {
    const res = await fetch(api.users.me, {
      headers: { Authorization: `Bearer ${authStore.token}` }
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
        dm_permission: 'anyone',
      }

      const settingsRes = await fetch(api.users.meSettings, {
        headers: { Authorization: `Bearer ${authStore.token}` }
      })
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        form.value.dm_permission = settingsData.data?.dm_permission || 'anyone'
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const save = async () => {
  error.value = ''
  success.value = false

  saving.value = true
  try {
    const settingsRes = await fetch(api.users.meSettings, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ dm_permission: form.value.dm_permission })
    })
    if (!settingsRes.ok) {
      const settingsError = await settingsRes.json().catch(() => ({}))
      throw new Error(typeof settingsError.error === 'string' ? settingsError.error : '私信设置保存失败')
    }

    const { dm_permission: _dmPermission, ...profilePayload } = form.value

    const res = await fetch(api.users.settings, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      },
      body: JSON.stringify(profilePayload)
    })

    if (res.ok) {
      const d = await res.json()
      const updated = d.data || d
      // Update local user state
      if (authStore.user) {
        authStore.user.display_name = updated.display_name
        authStore.user.avatar_url = updated.avatar_url
        authStore.user.bio = updated.bio
        localStorage.setItem('user', JSON.stringify(authStore.user))
      }
      success.value = true
      setTimeout(() => { success.value = false }, 3000)
    } else {
      const err = await res.json()
      error.value = err.error || '保存失败'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '网络错误，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(loadProfile)
</script>
