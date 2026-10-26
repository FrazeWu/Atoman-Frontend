<template>
  <div class="short-note-edit-mobile">
    <!-- Topbar -->
    <header class="edit-topbar">
      <button
        type="button"
        class="edit-topbar__btn"
        data-testid="note-edit-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>

      <span class="edit-topbar__title">编辑短笺</span>

      <MButton
        variant="primary"
        size="sm"
        :disabled="!content.trim() || saving"
        data-testid="note-edit-save-btn"
        @click="handleSave"
      >
        {{ saving ? '保存中...' : '保存' }}
      </MButton>
    </header>

    <main class="edit-body">
      <div v-if="loading" class="edit-loading">
        <p class="edit-loading-text">加载短笺中...</p>
      </div>

      <div v-else class="edit-form">
        <textarea
          v-model="content"
          class="edit-textarea"
          placeholder="编辑短笺内容..."
          rows="8"
          maxlength="1000"
          data-testid="note-edit-textarea"
        />
        <div class="edit-counter">
          <span>{{ content.length }}/1000</span>
        </div>

        <div v-if="mediaUrls.length > 0" class="edit-media-preview">
          <img
            v-for="(url, idx) in mediaUrls"
            :key="idx"
            :src="url"
            alt="配图"
            class="edit-media-img"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { apiRequestEnvelope } from '@/api/client'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()

const content = ref('')
const mediaUrls = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/posts/notes')
  }
}

async function loadNote() {
  const id = route.params.id as string
  if (!id) return

  loading.value = true
  try {
    const res = await apiRequestEnvelope<any>(api.blog.shortNote(id))
    if (res?.data) {
      content.value = res.data.content || ''
      if (Array.isArray(res.data.media)) {
        mediaUrls.value = res.data.media.map((m: any) => m.url).filter(Boolean)
      }
    }
  } catch {
    // Keep empty on error
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const id = route.params.id as string
  if (!id || !content.value.trim() || saving.value) return

  saving.value = true
  try {
    await apiRequestEnvelope(api.blog.shortNote(id), {
      method: 'PUT',
      body: JSON.stringify({
        content: content.value.trim(),
        media_urls: mediaUrls.value,
      }),
    })
    handleBack()
  } catch {
    // Handle error gracefully
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadNote()
})
</script>

<style scoped>
.short-note-edit-mobile {
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  display: flex;
  flex-direction: column;
}

.edit-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.edit-topbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--a-color-text, #18181b);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
}

.edit-topbar__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.edit-body {
  padding: 16px;
  flex: 1;
}

.edit-loading {
  padding: 32px 0;
  text-align: center;
}

.edit-loading-text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
}

.edit-textarea {
  width: 100%;
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
  border-radius: var(--a-radius-card, 4px);
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--a-color-text, #18181b);
  background: var(--a-color-bg, #ffffff);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.edit-textarea:focus {
  border-color: var(--a-color-primary, #10b981);
}

.edit-counter {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  font-size: 11px;
  color: var(--a-color-text-secondary, #a1a1aa);
}

.edit-media-preview {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
}

.edit-media-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--a-radius-card, 4px);
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
}
</style>
