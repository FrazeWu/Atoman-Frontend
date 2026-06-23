<script setup lang="ts">
import { computed, ref } from 'vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { uploadMusicAsset } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const artistDraft = computed(() => creationFlow.value?.draft.artist ?? null)
const avatarUploading = ref(false)
const avatarErrorMessage = ref('')

async function onAvatarChange(event: Event) {
  if (!artistDraft.value) return

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  avatarUploading.value = true
  avatarErrorMessage.value = ''

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    artistDraft.value.avatarAsset = asset
    artistDraft.value.avatarUrl = asset.url
  } catch (error) {
    avatarErrorMessage.value = error instanceof Error ? error.message : '头像上传失败'
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <div v-if="artistDraft" class="artist-step" data-testid="artist-step">
    <div class="artist-step-card">
      <div class="section-heading">
        <span class="section-dot" aria-hidden="true" />
        <div>
          <p class="step-kicker">Artist Entry</p>
          <h4>创建艺术家</h4>
          <p class="step-copy">按固定顺序先记录艺术家基础信息，再进入首张专辑草稿。</p>
        </div>
      </div>

      <div class="field-stack">
        <div class="field-group">
          <span class="field-label">头像</span>
          <div class="avatar-upload">
            <PAvatar
              :src="artistDraft.avatarUrl || undefined"
              :name="artistDraft.name || 'Artist'"
              size="lg"
            />
            <div class="avatar-upload__controls">
              <PInput
                data-testid="artist-avatar-input"
                type="file"
                accept="image/*"
                :disabled="avatarUploading"
                @change="onAvatarChange"
              />
              <p v-if="avatarErrorMessage" class="state-line state-line--error">{{ avatarErrorMessage }}</p>
              <p v-else-if="avatarUploading" class="state-line">正在上传头像...</p>
              <p v-else-if="artistDraft.avatarUrl" class="state-line">已选择头像，提交时会携带该资源。</p>
              <p v-else class="state-line">支持图片上传，使用现有音乐封面资源通道。</p>
            </div>
          </div>
        </div>

        <div class="field-group">
          <PInput
            v-model="artistDraft.name"
            data-testid="artist-name-input"
            type="text"
            placeholder="例如 kanye_west"
            label="名字"
          />
        </div>

        <div class="field-group">
          <span class="field-label">国家</span>
          <PCountryRegionField
            v-model="artistDraft.country"
            label="国家"
            placeholder="选择国家或地区"
            trigger-test-id="artist-country-trigger"
            search-test-id="artist-country-search"
            option-prefix="artist-country-option-"
          />
        </div>

        <div class="field-group">
          <PInput
            v-model="artistDraft.birthday"
            data-testid="artist-birthday-input"
            type="date"
            label="生日"
          />
        </div>

        <div class="field-group">
          <PTextarea
            v-model="artistDraft.bio"
            data-testid="artist-bio-input"
            :rows="4"
            placeholder="简要描述艺术家背景"
            label="简介"
          />
        </div>

        <div class="field-group">
          <PTextarea
            v-model="artistDraft.source"
            data-testid="artist-source-input"
            :rows="3"
            placeholder="记录资料来源"
            label="来源"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-step { display: flex; flex: 1; flex-direction: column; gap: 1rem; }
.artist-step-card {
  display: grid;
  gap: 1.2rem;
  padding: 1.4rem 1.5rem 1.35rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  background: var(--a-color-paper-soft);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}
.section-dot {
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  margin-top: 0.35rem;
  flex-shrink: 0;
}
.step-kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.artist-step-card h4 { margin: 0; font-family: var(--a-font-serif); font-size: 1.45rem; line-height: 1.1; }
.step-copy { margin: 0.4rem 0 0; color: var(--a-color-ink-soft); line-height: 1.6; max-width: 36rem; }
.field-stack { display: grid; gap: 1rem; }
.field-group { display: grid; gap: 0.45rem; }
.avatar-upload {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.avatar-upload__controls {
  flex: 1;
  display: grid;
  gap: 0.45rem;
}
.field-label {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.field-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 24%, transparent);
  border-radius: 0;
  padding: 0.25rem 0 0.72rem;
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
}
:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-accent-confirm);
}
.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
  line-height: 1.6;
}
.field-input--file {
  border: 1px dashed color-mix(in srgb, var(--a-color-ink) 16%, transparent);
  padding: 0.85rem 0.95rem;
  color: var(--a-color-ink-soft);
  background: var(--a-color-bg);
}
.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.9rem;
  line-height: 1.5;
}
.state-line--error {
  color: var(--a-color-accent-destructive);
}
</style>
