<template>
  <div class="a-page">
    <APageHeader title="添加/补全艺术家" sub="向音乐档案库添加新的艺术家资料。" accent />

    <ASurface class="form-surface" tone="soft" :layer="1">
      <form @submit.prevent="handleSubmit" class="manuscript-form">
        <div class="form-section">
          <AInput
            v-model="name"
            label="艺术家名称"
            placeholder="例如：kanye_west"
            required
            :error="errors.name"
          />

          <ATextarea
            v-model="bio"
            label="个人简介 / 履历"
            placeholder="输入艺术家的详细生平、音乐风格和主要成就..."
            :rows="6"
            :error="errors.bio"
          />
        </div>

        <div class="form-actions">
          <ABtn type="submit" class="submit-btn" :disabled="submitting">
            {{ submitting ? '正在创建...' : '创建艺术家' }}
          </ABtn>
        </div>
      </form>
    </ASurface>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import ABtn from '@/components/ui/ABtn.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const api = useApi()
const auth = useAuthStore()

const name = ref('')
const bio = ref('')
const submitting = ref(false)
const errors = ref<Record<string, string>>({})

onMounted(() => {
  if (route.query.name) {
    name.value = String(route.query.name)
  }
})

async function handleSubmit() {
  errors.value = {}
  if (!name.value.trim()) {
    errors.value.name = '请输入艺术家名称'
    return
  }

  submitting.value = true
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`
    }

    const res = await fetch(api.music.artists, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: name.value.trim(),
        bio: bio.value.trim(),
      }),
    })

    if (res.ok) {
      router.push('/')
    } else {
      const errData = await res.json()
      errors.value.name = errData.error || '创建失败，可能由于该艺术家已存在'
    }
  } catch (e) {
    console.error('Failed to create artist:', e)
    errors.value.name = '网络错误，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-surface {
  max-width: 36rem;
  margin: 2rem auto;
  padding: 2.5rem;
  border: 2px solid var(--a-color-ink);
  box-shadow: 12px 12px 0 0 rgba(0, 0, 0, 1);
}

.manuscript-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.submit-btn {
  width: 100%;
  border: 2px solid var(--a-color-ink);
  padding: 0.875rem;
  font-weight: 900;
  font-size: 1rem;
  background: var(--a-color-ink);
  color: white;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: var(--a-color-bg);
  color: var(--a-color-ink);
  box-shadow: 6px 6px 0 0 rgba(0, 0, 0, 0.15);
}
</style>
