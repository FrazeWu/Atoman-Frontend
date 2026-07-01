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
    <div class="artist-step-shell">
      <header class="artist-hero">
        <div class="artist-hero__meta">
          <p class="hero-kicker">音乐档案提交</p>
          <p class="hero-step">第 1 步 / 艺术家资料</p>
        </div>
        <h4>新建艺术家</h4>
        <p class="hero-copy">先提交艺术家资料，再继续补充首张专辑。这些字段会作为正式档案内容进入音乐库。</p>
      </header>

      <section class="artist-card artist-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">基本信息</p>
            <p class="card-copy">先确认这个人是谁，以及在站内如何被展示。</p>
          </div>
        </div>

        <div class="avatar-panel">
          <PAvatar
            :src="artistDraft.avatarUrl || undefined"
            :name="artistDraft.legalName || artistDraft.stageNames[0]?.name || 'Artist'"
            size="lg"
          />

          <div class="avatar-panel__controls">
            <div class="field-group">
              <span class="field-label">头像</span>
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

            <div class="field-group">
              <PInput
                v-model="artistDraft.legalName"
                data-testid="artist-legal-name-input"
                type="text"
                placeholder="例如 Kanye Omari West"
                label="名字（本名）"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="artist-card artist-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">艺名与沿革</p>
            <p class="card-copy">第一个艺名作为当前展示名，其余艺名按使用时期记录。</p>
          </div>
          <button
            data-testid="artist-add-stage-name-button"
            type="button"
            class="paper-action paper-action--inline"
            @click="addStageName"
          >
            + 添加另一个艺名
          </button>
        </div>

        <div class="field-stack">
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
            <div v-if="index > 0" class="stage-name-dates">
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
      </section>

      <section class="artist-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">背景资料</p>
            <p class="card-copy">这部分更像投稿说明，给审核和后续读者使用。</p>
          </div>
        </div>

        <div class="field-stack">
          <div class="field-grid field-grid--duo">
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
          </div>

          <div class="field-group field-group--narrow">
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
      </section>

      <div class="step-actions">
        <button
          data-testid="artist-next-button"
          type="button"
          class="paper-submit"
          :disabled="avatarUploading"
          @click="goNext"
        >
          下一步：继续补专辑
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.artist-step-shell {
  display: grid;
  gap: 1rem;
}

.artist-hero {
  display: grid;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.artist-hero__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-kicker,
.hero-step,
.card-kicker,
.field-label {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.artist-hero h4 {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-ink-soft);
  line-height: 1.7;
}

.artist-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.artist-card--primary {
  background: color-mix(in srgb, var(--a-color-paper) 82%, var(--a-color-paper-soft));
}

.artist-card--soft {
  background: var(--a-color-paper-soft);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.avatar-panel {
  display: flex;
  gap: 1.1rem;
  align-items: flex-start;
}

.avatar-panel__controls {
  flex: 1;
  display: grid;
  gap: 1rem;
}

.field-stack { display: grid; gap: 1rem; }
.field-grid { display: grid; gap: 1rem; }
.field-grid--duo { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-group { display: grid; gap: 0.45rem; }
.field-group--narrow { max-width: 16rem; }

.stage-name-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-paper-wash) 86%, var(--a-color-paper));
}

.stage-name-dates {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  gap: 1rem;
  align-items: center;
  padding-top: 0.25rem;
}

.paper-action,
.paper-submit {
  border: 0;
  border-radius: 0;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}

.paper-action {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font-size: 0.78rem;
}

.paper-submit {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  transition: background-color 0.15s ease;
}

.paper-submit:hover {
  background: color-mix(in srgb, var(--a-color-ink) 86%, black);
}

@media (max-width: 720px) {
  .field-grid--duo,
  .stage-name-dates {
    grid-template-columns: 1fr;
  }

  .avatar-panel {
    flex-direction: column;
  }
}
</style>
