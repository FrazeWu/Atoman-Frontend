<script setup lang="ts">
import { computed, ref } from 'vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { uploadMusicAsset } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, setMusicCreationStep } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const artistDraft = computed(() => creationFlow.value?.draft.artist ?? null)
const avatarUploading = ref(false)
const avatarErrorMessage = ref('')
const stageNameErrorMessage = ref('')

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

function addStageName() {
  if (!artistDraft.value) return

  artistDraft.value.stageNames.push({
    id: `stage-name-${Date.now()}-${artistDraft.value.stageNames.length + 1}`,
    name: '',
    isPrimary: false,
    startDateText: '',
    endDateText: '',
  })
}

function validateStageNames() {
  if (!artistDraft.value) return false

  const hasInvalidAdditionalStage = artistDraft.value.stageNames.slice(1).some((item) => {
    return item.name.trim() && !item.startDateText.trim() && !item.endDateText.trim()
  })

  stageNameErrorMessage.value = hasInvalidAdditionalStage ? '请为追加艺名补充持续时间' : ''
  return !hasInvalidAdditionalStage
}

function goNext() {
  if (!artistDraft.value) return
  if (!validateStageNames()) return
  setMusicCreationStep('albumImport')
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
          <p class="step-copy">先补齐艺术家基础信息，再进入专辑压缩包导入。</p>
        </div>
      </div>

      <div class="field-stack">
        <div class="field-group">
          <span class="field-label">头像</span>
          <div class="avatar-upload">
            <PAvatar
              :src="artistDraft.avatarUrl || undefined"
              :name="artistDraft.legalName || artistDraft.stageNames[0]?.name || 'Artist'"
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
            v-model="artistDraft.legalName"
            data-testid="artist-legal-name-input"
            type="text"
            placeholder="例如 Kanye Omari West"
            label="名字（本名）"
          />
        </div>

        <div class="field-group">
          <div class="field-inline">
            <span class="field-label">艺名列表</span>
            <button
              data-testid="artist-add-stage-name-button"
              type="button"
              class="paper-action paper-action--inline"
              @click="addStageName"
            >
              + 添加另一个艺名
            </button>
          </div>

          <div
            v-for="(stageName, index) in artistDraft.stageNames"
            :key="stageName.id"
            class="stage-name-card"
          >
            <PInput
              v-model="stageName.name"
              :data-testid="`artist-stage-name-input-${index}`"
              type="text"
              :label="index === 0 ? '主艺名' : `追加艺名 ${index}`"
              placeholder="例如 Kanye West / Ye"
              @update:model-value="stageNameErrorMessage = ''"
            />
            <div class="stage-name-dates">
              <PInput
                v-model="stageName.startDateText"
                :data-testid="`artist-stage-start-input-${index}`"
                type="text"
                label="开始时间"
                placeholder="例如 2018"
                @update:model-value="stageNameErrorMessage = ''"
              />
              <PInput
                v-model="stageName.endDateText"
                :data-testid="`artist-stage-end-input-${index}`"
                type="text"
                label="结束时间"
                placeholder="例如 2021 / 至今"
                @update:model-value="stageNameErrorMessage = ''"
              />
            </div>
          </div>

          <p
            v-if="stageNameErrorMessage"
            data-testid="artist-stage-name-error"
            class="state-line state-line--error"
          >
            {{ stageNameErrorMessage }}
          </p>
        </div>

        <div class="field-group">
          <span class="field-label">国籍</span>
          <PCountryRegionField
            v-model="artistDraft.nationality"
            label="国籍"
            placeholder="选择国家或地区"
            trigger-test-id="artist-country-trigger"
            search-test-id="artist-country-search"
            option-prefix="artist-country-option-"
          />
        </div>

        <div class="field-group">
          <PInput
            v-model="artistDraft.birthPlace"
            data-testid="artist-birth-place-input"
            type="text"
            placeholder="例如 Atlanta, Georgia, U.S."
            label="出生地"
          />
        </div>

        <div class="field-group">
          <PInput
            v-model="artistDraft.birthDate"
            data-testid="artist-birth-date-input"
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
            label="信息来源"
          />
        </div>
      </div>

      <div class="step-actions">
        <button
          data-testid="artist-next-button"
          type="button"
          class="paper-submit"
          :disabled="avatarUploading"
          @click="goNext"
        >
          下一步
        </button>
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
.field-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
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
.stage-name-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
}
.stage-name-dates {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.field-label {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-accent-confirm);
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
.step-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}
.paper-action {
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  padding: 0.55rem 0.9rem;
  background: transparent;
  color: var(--a-color-ink);
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}
.paper-action--inline {
  padding-inline: 0.75rem;
}
.paper-submit {
  border: 0;
  border-radius: 0;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
  background: var(--a-color-accent-confirm);
  color: var(--a-color-paper);
  transition: background-color 0.15s ease;
}
.paper-submit:hover {
  background: var(--a-color-accent-confirm-hover);
}
.paper-submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
@media (max-width: 720px) {
  .field-inline,
  .avatar-upload,
  .stage-name-dates {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
