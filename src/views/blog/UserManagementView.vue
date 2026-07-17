<template>
  <section class="user-management a-page-xl">
    <header class="user-management__page-head">
      <div>
        <h1>用户管理</h1>
        <p>更新你的公开资料和联系权限。</p>
      </div>
      <a :href="userUrl(authStore.user?.username || '')" class="a-link">我的主页</a>
    </header>

    <PButton
      class="user-management__directory-trigger"
      variant="secondary"
      size="sm"
      @click="mobileDirectoryOpen = true"
    >
      <ListTree :size="16" aria-hidden="true" />
      目录
    </PButton>

    <div class="user-management__layout" :class="{ 'is-directory-collapsed': directoryCollapsed }">
      <form class="user-management__sections" @submit.prevent="save">
        <section id="user-profile" class="user-management__section">
          <header class="user-management__section-head">
            <span>01</span>
            <div>
              <h2>个人资料</h2>
              <p>设置头像、名称和个人简介。</p>
            </div>
          </header>

          <div class="user-management__profile-preview">
            <div class="user-management__avatar">
              <img v-if="form.avatar_url" :src="form.avatar_url" alt="" />
              <span v-else>{{ userInitial }}</span>
            </div>
            <div>
              <strong>{{ form.display_name || authStore.user?.username }}</strong>
              <span>@{{ authStore.user?.username }}</span>
            </div>
          </div>

          <div class="user-management__fields">
            <label class="a-field">
              <span class="a-field-label">显示名称</span>
              <input v-model="form.display_name" placeholder="用于展示的名称" class="a-input" />
            </label>
            <label class="a-field">
              <span class="a-field-label">头像 URL</span>
              <input v-model="form.avatar_url" placeholder="https://example.com/avatar.jpg" type="url" class="a-input" />
            </label>
            <label class="a-field user-management__field--wide">
              <span class="a-field-label">个人简介</span>
              <textarea v-model="form.bio" placeholder="介绍一下自己" rows="4" class="a-textarea" />
            </label>
          </div>
        </section>

        <section id="user-public" class="user-management__section">
          <header class="user-management__section-head">
            <span>02</span>
            <div>
              <h2>公开信息</h2>
              <p>这些信息会显示在你的个人主页。</p>
            </div>
          </header>

          <div class="user-management__fields">
            <label class="a-field">
              <span class="a-field-label">个人网站</span>
              <input v-model="form.website" placeholder="https://yoursite.com" type="url" class="a-input" />
            </label>
            <label class="a-field">
              <span class="a-field-label">所在地</span>
              <input v-model="form.location" placeholder="城市或地区" class="a-input" />
            </label>
          </div>
        </section>

        <section id="user-contact" class="user-management__section">
          <header class="user-management__section-head">
            <span>03</span>
            <div>
              <h2>联系权限</h2>
              <p>选择谁可以向你发送私信。</p>
            </div>
          </header>

          <label class="a-field user-management__permission-field">
            <span class="a-field-label">私信权限</span>
            <PSelect v-model="form.dm_permission" :options="dmPermissionOptions" />
          </label>

          <p v-if="error" class="a-error" role="alert">{{ error }}</p>
          <p v-if="success" class="a-success" role="status">保存成功</p>

          <div class="user-management__actions">
            <PButton type="submit" :loading="saving" loading-text="保存中...">保存更改</PButton>
          </div>
        </section>
      </form>

      <PDirectoryNav
        v-model:collapsed="directoryCollapsed"
        :items="directoryItems"
        :active-id="activeSection"
        :mobile-open="mobileDirectoryOpen"
        aria-label="用户管理目录"
        @select="scrollToSection"
        @close-mobile="mobileDirectoryOpen = false"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ListTree } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PDirectoryNav from '@/components/ui/PDirectoryNav.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { userUrl } from '@/composables/useSubdomainNav'
import { useApi } from '@/composables/useApi'
import type { DMPermission } from '@/types'

const authStore = useAuthStore()
const api = useApi()

type UserManagementSection = 'profile' | 'public' | 'contact'

const sectionOrder: UserManagementSection[] = ['profile', 'public', 'contact']
const directoryItems = [
  { id: 'profile', label: '个人资料' },
  { id: 'public', label: '公开信息' },
  { id: 'contact', label: '联系权限' },
]

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
const activeSection = ref<UserManagementSection>('profile')
const directoryCollapsed = ref(false)
const mobileDirectoryOpen = ref(false)
const userInitial = computed(() => (
  form.value.display_name || authStore.user?.username || '?'
).charAt(0).toUpperCase())

function sectionId(section: UserManagementSection) {
  return `user-${section}`
}

function scrollToSection(section: string) {
  if (!sectionOrder.includes(section as UserManagementSection)) return
  const target = section as UserManagementSection
  document.getElementById(sectionId(target))?.scrollIntoView({ block: 'start' })
  activeSection.value = target
  mobileDirectoryOpen.value = false
}

function syncActiveSection() {
  const anchor = window.scrollY + 180
  let next = sectionOrder[0]

  for (const section of sectionOrder) {
    const element = document.getElementById(sectionId(section))
    if (!element || element.getBoundingClientRect().top + window.scrollY > anchor) break
    next = section
  }

  activeSection.value = next
}

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

onMounted(async () => {
  await loadProfile()
  await nextTick()
  syncActiveSection()
  window.addEventListener('scroll', syncActiveSection, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncActiveSection)
})
</script>

<style scoped>
.user-management {
  display: grid;
  gap: 1.5rem;
  padding-bottom: 8rem;
}

.user-management__page-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--a-color-line);
}

.user-management__page-head h1,
.user-management__page-head p,
.user-management__section-head h2,
.user-management__section-head p,
.user-management__profile-preview strong,
.user-management__profile-preview span,
.user-management__permission-field,
.user-management__section .a-error,
.user-management__section .a-success {
  margin: 0;
}

.user-management__page-head h1 {
  color: var(--a-color-ink);
  font-size: 2rem;
  line-height: 1.2;
}

.user-management__page-head p,
.user-management__section-head p,
.user-management__profile-preview span {
  color: var(--a-color-ink-muted);
}

.user-management__directory-trigger {
  display: none;
  justify-self: start;
}

.user-management__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13.75rem;
  gap: 2rem;
  align-items: start;
  transition: grid-template-columns 0.2s ease;
}

.user-management__layout.is-directory-collapsed {
  grid-template-columns: minmax(0, 1fr) 3rem;
}

.user-management__sections {
  display: grid;
  min-width: 0;
}

.user-management__section {
  display: grid;
  gap: 1.5rem;
  padding: 2rem 0 2.5rem;
  border-top: 1px solid var(--a-color-line);
  scroll-margin-top: calc(var(--a-topbar-height) + 1rem);
}

.user-management__section:first-child {
  border-top: 2px solid var(--a-color-ink);
}

.user-management__section-head {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.user-management__section-head > span {
  padding-top: 0.25rem;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-meta);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
}

.user-management__section-head h2 {
  font-size: 1.25rem;
}

.user-management__profile-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--a-color-line-soft);
  border-bottom: 1px solid var(--a-color-line-soft);
}

.user-management__profile-preview > div:last-child {
  display: grid;
  gap: 0.2rem;
}

.user-management__avatar {
  display: grid;
  width: 4rem;
  height: 4rem;
  flex: 0 0 4rem;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--a-color-ink);
  color: var(--a-color-bg);
  font-size: 1.5rem;
  font-weight: var(--a-font-weight-strong);
}

.user-management__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-management__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.user-management__field--wide {
  grid-column: 1 / -1;
}

.user-management__permission-field {
  max-width: 24rem;
}

.user-management__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-line-soft);
}

@media (max-width: 1023px) {
  .user-management__directory-trigger {
    display: inline-flex;
  }

  .user-management__layout,
  .user-management__layout.is-directory-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .user-management__page-head {
    align-items: start;
    flex-direction: column;
  }

  .user-management__fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .user-management__page-head .a-link {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
  }

  .user-management__field--wide {
    grid-column: auto;
  }

  .user-management__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
