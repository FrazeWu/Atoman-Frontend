<template>
  <section class="setting-announcements settings-center">
    <PSectionHeader title="发布公告" kicker="SITE ANNOUNCEMENTS" description="发布后会作为系统通知投递给所有活跃用户。" />

    <PSurface :layer="1" class="setting-announcements__surface">
      <form class="setting-announcements__form" @submit.prevent="requestPublish">
        <PInput
          v-model="title"
          label="公告标题"
          hint="最多 120 个字符"
          maxlength="120"
          autocomplete="off"
          :error="titleError"
        />
        <PTextarea
          v-model="body"
          label="公告正文"
          hint="纯文本，最多 1000 个字符"
          :rows="8"
          maxlength="1000"
          :error="bodyError"
        />
        <PInput
          v-model="path"
          label="站内跳转地址"
          hint="可选，必须以 / 开头，例如 /status"
          placeholder="/status"
          autocomplete="off"
          :error="pathError"
        />

        <p v-if="error" class="setting-announcements__message setting-announcements__message--error">{{ error }}</p>
        <p v-else-if="success" class="setting-announcements__message">{{ success }}</p>

        <div class="setting-announcements__actions">
          <PButton type="submit" :loading="publishing" loading-text="发布中...">发布公告</PButton>
        </div>
      </form>
    </PSurface>
  </section>
  <PConfirm
    :show="confirmOpen"
    title="发布站点公告"
    :message="`将向所有活跃用户投递“${title.trim()}”。已发布内容会作为系统通知进入用户收件箱。`"
    confirm-text="确认发布"
    cancel-text="取消"
    :loading="publishing"
    loading-text="发布中..."
    @confirm="publish"
    @cancel="confirmOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { publishAnnouncement } from '@/api/adminAnnouncements'

const title = ref('')
const body = ref('')
const path = ref('')
const confirmOpen = ref(false)
const publishing = ref(false)
const error = ref('')
const success = ref('')

const titleError = computed(() => title.value.trim() ? '' : '请输入公告标题')
const bodyError = computed(() => body.value.trim() ? '' : '请输入公告正文')
const pathError = computed(() => {
  const value = path.value.trim()
  return value && (!value.startsWith('/') || value.startsWith('//')) ? '请输入有效的站内路径' : ''
})

const requestPublish = () => {
  error.value = ''
  success.value = ''
  if (titleError.value || bodyError.value || pathError.value) return
  confirmOpen.value = true
}

const publish = async () => {
  if (publishing.value) return
  publishing.value = true
  error.value = ''
  try {
    const result = await publishAnnouncement({
      title: title.value.trim(),
      body: body.value.trim(),
      ...(path.value.trim() ? { path: path.value.trim() } : {}),
    })
    success.value = `已向 ${result.delivered} 位活跃用户发布公告。`
    title.value = ''
    body.value = ''
    path.value = ''
    confirmOpen.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '公告暂时无法发布，请稍后重试。'
  } finally {
    publishing.value = false
  }
}
</script>

<style scoped>
.setting-announcements {
  display: grid;
  gap: 1.5rem;
}

.setting-announcements__surface {
  max-width: 48rem;
}

.setting-announcements__form {
  display: grid;
  gap: 1.25rem;
}

.setting-announcements__message {
  margin: 0;
  color: var(--a-color-success);
  font-size: 0.86rem;
  font-weight: 600;
}

.setting-announcements__message--error {
  color: var(--a-color-danger);
}

.setting-announcements__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .setting-announcements__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
